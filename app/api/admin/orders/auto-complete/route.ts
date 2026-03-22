import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const GRACE_DAYS = 3; // Auto-complete 3 days after estimated delivery (or shipping date)

/**
 * Shared logic: find and complete overdue shipped orders.
 * - Primary: orders where estimated_delivery + 3 days has passed
 * - Fallback: orders with no estimated_delivery where updated_at + 3 days has passed
 *   (updated_at is set to the time the order was marked Shipped)
 */
async function runAutoComplete() {
  const supabase = createAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - GRACE_DAYS);
  const cutoffISO = cutoff.toISOString();

  // Fetch all shipped orders (with or without estimated_delivery)
  const { data: orders, error: fetchError } = await supabase
    .from('orders')
    .select('id, user_id, estimated_delivery, updated_at, delivery_location')
    .eq('order_status', 'Shipped');

  if (fetchError) throw fetchError;
  if (!orders || orders.length === 0) {
    return { orders_completed: 0 };
  }

  // Filter: complete if (estimated_delivery || updated_at) + 3 days has passed
  const toComplete = orders.filter((order: any) => {
    const referenceDate = order.estimated_delivery || order.updated_at;
    if (!referenceDate) return false;
    return new Date(referenceDate) <= cutoff;
  });

  if (toComplete.length === 0) {
    return { orders_completed: 0 };
  }

  let completedCount = 0;
  const now = new Date().toISOString();

  for (const order of toComplete) {
    try {
      const usedFallback = !order.estimated_delivery;

      // Update order: mark delivered, set delivered_at timestamp
      await supabase
        .from('orders')
        .update({
          order_status: 'Delivered',
          delivered_at: now,
          updated_at: now,
        })
        .eq('id', order.id);

      // Add tracking entry
      try {
        await supabase.from('order_tracking').insert({
          order_id: order.id,
          order_status: 'Delivered',
          title: 'Order Delivered',
          body: usedFallback
            ? `Your order has been automatically marked as delivered (${GRACE_DAYS} days after shipment).`
            : `Your order has been automatically marked as delivered (${GRACE_DAYS} days after expected delivery).`,
        });
      } catch {
        // Non-critical
      }

      // Notify customer
      try {
        await supabase.from('notifications').insert({
          user_id: order.user_id,
          title: 'Order Delivered',
          body: `Your order has been marked as delivered. Thank you for shopping with Scentopia!`,
          type: 'order_update',
          data: {
            order_id: order.id,
            auto_completed: true,
          },
        });
      } catch {
        // Non-critical
      }

      completedCount++;
    } catch (err) {
      console.error(`Auto-complete failed for order ${order.id}:`, err);
    }
  }

  return { orders_completed: completedCount };
}

/**
 * GET /api/admin/orders/auto-complete
 *
 * Vercel cron hits this endpoint daily.
 * Also returns a preview of orders pending auto-completion for the admin UI.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  // If called by Vercel cron, run the job
  if (isCron) {
    try {
      const result = await runAutoComplete();
      return NextResponse.json({
        success: true,
        data: result,
        message: `Auto-completed ${result.orders_completed} orders`,
      });
    } catch (error) {
      console.error('Cron auto-complete error:', error);
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Auto-complete failed' },
        { status: 500 }
      );
    }
  }

  // Otherwise: admin UI preview — list shipped orders with countdown
  try {
    const supabase = createAdminClient();

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        order_status,
        estimated_delivery,
        updated_at,
        delivery_location,
        amount
      `)
      .eq('order_status', 'Shipped')
      .order('estimated_delivery', { ascending: true });

    if (error) throw error;

    const now = new Date();

    const enriched = (orders || []).map((order: any) => {
      const referenceDate = order.estimated_delivery || order.updated_at;
      const autoCompleteAt = referenceDate
        ? new Date(new Date(referenceDate).getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000)
        : null;

      const daysLeft = autoCompleteAt
        ? Math.ceil((autoCompleteAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        id: order.id,
        amount: order.amount,
        estimated_delivery: order.estimated_delivery,
        auto_complete_at: autoCompleteAt?.toISOString() ?? null,
        days_until_auto_complete: daysLeft,
        is_overdue: daysLeft !== null && daysLeft <= 0,
        used_fallback: !order.estimated_delivery,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        orders: enriched,
        total: enriched.length,
        overdue_count: enriched.filter((o: any) => o.is_overdue).length,
        grace_days: GRACE_DAYS,
      },
    });
  } catch (error) {
    console.error('Error fetching auto-complete preview:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/orders/auto-complete
 *
 * Manual trigger from admin dashboard or external cron service.
 */
export async function POST(request: NextRequest) {
  // Auth: accept CRON_SECRET Bearer token OR authenticated admin session
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!(cronSecret && authHeader === `Bearer ${cronSecret}`)) {
    const supabase = createAdminClient();
    // For POST from admin UI, verify the user is logged in via cookie session
    const anonClient = await import('@/lib/supabase/server').then(m => m.createClient());
    const { data: { user }, error } = await (anonClient as any).auth.getUser();
    if (error || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await runAutoComplete();
    return NextResponse.json({
      success: true,
      data: result,
      message: result.orders_completed > 0
        ? `Auto-completed ${result.orders_completed} order(s)`
        : 'No orders needed auto-completion',
    });
  } catch (error) {
    console.error('Manual auto-complete error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Auto-complete failed' },
      { status: 500 }
    );
  }
}
