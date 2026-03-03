import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/orders/auto-complete
 *
 * Manually triggers the auto-completion check for shipped orders
 * that are past their expected delivery date + 7 days.
 *
 * This endpoint can be called:
 * 1. Manually from the admin dashboard
 * 2. Via external cron service (like cron-job.org)
 * 3. As a scheduled Edge Function
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication (optional for cron jobs with API key)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is set, allow unauthenticated access with correct secret
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      // Authorized via cron secret
    } else {
      // Check for authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Call the Supabase RPC function
    const { data, error } = await supabase.rpc('check_auto_delivery');

    if (error) {
      console.error('Error running auto-delivery check:', error);

      // If the function doesn't exist, run the check manually
      if (error.message.includes('does not exist')) {
        return await runManualAutoComplete(supabase);
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Auto-delivery check completed successfully'
    });

  } catch (error) {
    console.error('Error in auto-complete endpoint:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Manual implementation of auto-complete logic
 * Used if the Supabase function doesn't exist
 */
async function runManualAutoComplete(supabase: any) {
  try {
    // Find shipped orders past their auto-complete date
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: orders, error: fetchError } = await supabase
      .from('orders')
      .select('id, user_id, waybill_number')
      .eq('order_status', 'Shipped')
      .not('estimated_delivery', 'is', null)
      .lt('estimated_delivery', sevenDaysAgo.toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        data: { orders_completed: 0 },
        message: 'No orders to auto-complete'
      });
    }

    let completedCount = 0;

    for (const order of orders) {
      try {
        // Update order status
        await supabase
          .from('orders')
          .update({
            order_status: 'Delivered',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        // Create tracking entry
        await supabase
          .from('order_tracking')
          .insert({
            order_id: order.id,
            order_status: 'Delivered',
            title: 'Order Auto-Completed',
            body: 'Order was automatically marked as delivered after 7 days past expected delivery date.'
          });

        // Try to create notification (optional)
        try {
          await supabase
            .from('notifications')
            .insert({
              user_id: order.user_id,
              title: 'Order Completed',
              body: 'Your order has been automatically marked as delivered.',
              type: 'order_update',
              data: {
                order_id: order.id,
                waybill_number: order.waybill_number,
                auto_completed: true
              }
            });
        } catch (notifError) {
          // Notification is optional
          console.log('Notification creation skipped:', notifError);
        }

        completedCount++;
      } catch (orderError) {
        console.error(`Error completing order ${order.id}:`, orderError);
      }
    }

    return NextResponse.json({
      success: true,
      data: { orders_completed: completedCount },
      message: `Auto-completed ${completedCount} orders`
    });

  } catch (error) {
    console.error('Error in manual auto-complete:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Manual auto-complete failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/orders/auto-complete
 *
 * Returns orders that are pending auto-completion
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Calculate the cutoff date (7 days from now)
    const autoCompleteDate = new Date();
    autoCompleteDate.setDate(autoCompleteDate.getDate() + 7);

    // Find shipped orders with estimated_delivery
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        waybill_number,
        courier_code,
        order_status,
        estimated_delivery,
        shipping_fee,
        amount,
        created_at,
        profiles!orders_user_id_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('order_status', 'Shipped')
      .not('estimated_delivery', 'is', null)
      .order('estimated_delivery', { ascending: true });

    if (error) {
      throw error;
    }

    // Calculate auto-complete date and days until auto-complete for each order
    const ordersWithAutoCompleteInfo = (orders || []).map((order: any) => {
      const estimatedDelivery = new Date(order.estimated_delivery);
      const autoCompleteAt = new Date(estimatedDelivery);
      autoCompleteAt.setDate(autoCompleteAt.getDate() + 7);

      const now = new Date();
      const daysUntilAutoComplete = Math.ceil((autoCompleteAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...order,
        auto_complete_date: autoCompleteAt.toISOString(),
        days_until_auto_complete: daysUntilAutoComplete,
        is_overdue: daysUntilAutoComplete < 0,
        customer_name: order.profiles ? `${order.profiles.first_name || ''} ${order.profiles.last_name || ''}`.trim() : 'Unknown',
        customer_email: order.profiles?.email
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        orders: ordersWithAutoCompleteInfo,
        total: ordersWithAutoCompleteInfo.length,
        overdue_count: ordersWithAutoCompleteInfo.filter((o: any) => o.is_overdue).length
      }
    });

  } catch (error) {
    console.error('Error fetching pending auto-complete orders:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
