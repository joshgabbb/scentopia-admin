import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminClient();

  try {
    const { id: orderId } = await context.params;
    const { status, title, body } = await request.json();

    // Block Processing/Shipped if order is not paid
    if (status === 'Processing' || status === 'Shipped') {
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

    // Update order status
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        order_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (orderError) throw orderError;

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

    // Send status update email (non-critical)
    try {
      await supabase.functions.invoke('send-status-email', {
        body: { order_id: orderId, status },
      });
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
