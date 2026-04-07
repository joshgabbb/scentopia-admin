import { createAdminClient } from "@/lib/supabase/server";
import { logAuditAction } from "@/lib/audit-logger";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminClient();

  try {
    const { id: orderId } = await context.params;
    const { status, title, body, tracking_url } = await request.json();

    // Block Processing/To Ship/Shipped if order is not paid
    if (status === 'Processing' || status === 'To Ship' || status === 'Shipped') {
      const { data: payment } = await supabase
        .from('payments')
        .select('status')
        .eq('order_id', orderId)
        .maybeSingle();

      const isPaid = payment?.status?.toLowerCase() === 'paid' || payment?.status?.toLowerCase() === 'completed';
      if (!isPaid) {
        return NextResponse.json(
          { success: false, error: 'Order must be paid before it can be processed or shipped.' },
          { status: 400 }
        );
      }
    }

    // Fetch current order status and order number for audit log
    const { data: currentOrder } = await supabase
      .from('orders')
      .select('order_status, order_number')
      .eq('id', orderId)
      .maybeSingle();

    const previousStatus = currentOrder?.order_status ?? null;
    const orderNumber = currentOrder?.order_number ?? orderId;

    // Update order status
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        order_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (orderError) throw orderError;

    // Log order status change to audit trail (non-critical)
    try {
      await logAuditAction(
        {
          action: 'UPDATE',
          module: 'ORDER',
          entityId: orderId,
          entityLabel: `Order #${orderNumber}`,
          oldValue: { status: previousStatus },
          newValue: { status },
          metadata: { changed_via: 'admin_dashboard' },
        },
        request
      );
    } catch {
      // Non-critical, continue
    }

    // Add tracking entry (non-critical — never fail the whole request)
    try {
      await supabase
        .from('order_tracking')
        .insert({
          order_id: orderId,
          order_status: status,
          title: title || `Order ${status}`,
          body: body || `Your order has been ${status.toLowerCase()}`,
        });
    } catch {
      // Non-critical, continue
    }

    // Refund wallet if cancelled and payment was via wallet (non-critical)
    if (status === 'Cancelled') {
      try {
        const { data: payments } = await supabase
          .from('payments')
          .select('payment_method, amount, user_id')
          .eq('order_id', orderId);

        const walletPayments = (payments ?? []).filter(
          (p: any) => p.payment_method?.toLowerCase() === 'wallet'
        );
        const walletTotal = walletPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        const userId = walletPayments[0]?.user_id;

        if (walletTotal > 0 && userId) {
          const { data: wallet } = await supabase
            .from('wallets')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

          if (wallet?.id) {
            const { data: txn } = await supabase
              .from('wallet_transactions')
              .insert({
                wallet_id: wallet.id,
                type: 'credit',
                amount: walletTotal,
                description: 'Refund for cancelled order',
                status: 'pending',
              })
              .select('id')
              .single();

            if (txn?.id) {
              await supabase
                .from('wallet_transactions')
                .update({ status: 'successful' })
                .eq('id', txn.id);
            }
          }
        }
      } catch {
        // Non-critical, continue
      }
    }

    // Send status update email (non-critical)
    try {
      await supabase.functions.invoke('send-status-email', {
        body: { order_id: orderId, status },
      });
    } catch {
      // Non-critical, continue
    }

    // Send push notification to customer (non-critical)
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('user_id')
        .eq('id', orderId)
        .maybeSingle();

      if (order?.user_id) {
        const notifMap: Record<string, { type: string; title: string; body: string }> = {
          Processing: {
            type: 'pending_order',
            title: '🔄 Order is Being Processed',
            body: "We're preparing your order. We'll notify you when it ships.",
          },
          'To Ship': {
            type: 'pending_order',
            title: '📦 Your Order is Packed!',
            body: "Your order is packed and ready to ship. We'll notify you once it's on its way.",
          },
          Shipped: {
            type: 'pending_order',
            title: '🚚 Your Order is On Its Way!',
            body: 'Your order is on its way. Track your delivery for updates.',
          },
          Delivered: {
            type: 'successful_order',
            title: '✅ Order Delivered!',
            body: 'Your order has been delivered. Enjoy your purchase!',
          },
          Cancelled: {
            type: 'cancelled_order',
            title: '❌ Order Cancelled',
            body: 'Your order has been cancelled. Contact support if you have questions.',
          },
          Refunded: {
            type: 'cancelled_order',
            title: '💸 Refund Processed',
            body: 'Your refund has been processed. It may take a few days to reflect.',
          },
        };

        const notif = notifMap[status];
        if (notif) {
          await supabase.from('notifications').insert({
            user_id: order.user_id,
            notification_type: notif.type,
            // Use custom title/body from caller (e.g. Lalamove sidebar) if provided
            title: title || notif.title,
            body: body || notif.body,
            is_read: false,
            send_push_notification: true,
            metadata: {
              action: 'order-redirect',
              order_id: orderId,
              // Include tracking URL so mobile can show a "Track Order" button
              ...(tracking_url ? { tracking_url } : {}),
            },
          });
        }
      }
    } catch {
      // Non-critical, continue
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Status update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update order status'
      },
      { status: 500 }
    );
  }
}
