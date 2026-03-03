// app/api/admin/reports/orders-report/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // all | fulfillment | cancellations
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const status = searchParams.get('status');

    console.log('📊 Orders Report API called with params:', { type, from, to, status });

    if (type === 'cancellations') {
      return await getCancellationsReport(supabase, { from, to });
    } else {
      return await getOrdersFulfillmentReport(supabase, { from, to, status, type });
    }
  } catch (error) {
    console.error('❌ Orders Report API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch orders report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function getOrdersFulfillmentReport(
  supabase: any,
  filters: { from?: string | null; to?: string | null; status?: string | null; type?: string }
) {
  let query = supabase
    .from('orders')
    .select(`
      id,
      amount,
      created_at,
      order_status,
      email,
      profiles!orders_user_id_fkey(
        first_name,
        last_name,
        email
      ),
      order_items!order_items_order_id_fkey(
        quantity
      ),
      payments!payments_order_id_fkey(
        status,
        payment_method
      )
    `)
    .order('created_at', { ascending: false });

  // Apply date filters
  if (filters.from) {
    query = query.gte('created_at', filters.from);
  }
  if (filters.to) {
    query = query.lte('created_at', filters.to + 'T23:59:59');
  }

  // Apply status filter for fulfillment type
  if (filters.type === 'fulfillment' && filters.status && filters.status !== 'all') {
    query = query.eq('order_status', filters.status);
  }

  const { data: orders, error } = await query;

  if (error) throw error;

  // Format orders
  const formattedOrders = orders?.map((order: any) => {
    const profile = order.profiles as {
      first_name?: string;
      last_name?: string;
      email?: string;
    } | null;

    const customerName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown Customer'
      : 'Unknown Customer';

    const customerEmail = profile?.email || order.email || 'No email';
    const payment = Array.isArray(order.payments) ? order.payments[0] : order.payments;

    const itemCount = order.order_items?.reduce(
      (sum: number, item: any) => sum + (Number(item.quantity) || 0),
      0
    ) || 0;

    return {
      id: order.id,
      orderNumber: `#${order.id.substring(0, 8).toUpperCase()}`,
      customerName,
      customerEmail,
      amount: Number(order.amount) || 0,
      status: order.order_status || 'Pending',
      paymentStatus: payment?.status || 'N/A',
      paymentMethod: payment?.payment_method || 'N/A',
      itemCount,
      createdAt: order.created_at,
    };
  }) || [];

  // Calculate status counts for summary
  const statusCounts = formattedOrders.reduce((acc: Record<string, number>, order) => {
    const status = order.status;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const totalRevenue = formattedOrders.reduce((sum, o) => sum + o.amount, 0);

  return NextResponse.json({
    success: true,
    data: {
      orders: formattedOrders,
      summary: {
        totalOrders: formattedOrders.length,
        totalRevenue,
        statusCounts,
      },
    },
  });
}

async function getCancellationsReport(
  supabase: any,
  filters: { from?: string | null; to?: string | null }
) {
  // First check if cancelled_orders table exists by trying to query it
  const { data: cancelledOrders, error: cancelledError } = await supabase
    .from('cancelled_orders')
    .select(`
      id,
      order_id,
      reason,
      refund_status,
      cancelled_at,
      orders!cancelled_orders_order_id_fkey(
        id,
        amount,
        created_at,
        email,
        profiles!orders_user_id_fkey(
          first_name,
          last_name,
          email
        )
      )
    `)
    .order('cancelled_at', { ascending: false });

  // If cancelled_orders table works, use it
  if (!cancelledError && cancelledOrders) {
    let filtered = cancelledOrders;

    // Apply date filters
    if (filters.from) {
      filtered = filtered.filter((c: any) =>
        new Date(c.cancelled_at) >= new Date(filters.from!)
      );
    }
    if (filters.to) {
      filtered = filtered.filter((c: any) =>
        new Date(c.cancelled_at) <= new Date(filters.to + 'T23:59:59')
      );
    }

    const formattedCancellations = filtered.map((cancel: any) => {
      const order = cancel.orders;
      const profile = order?.profiles as {
        first_name?: string;
        last_name?: string;
        email?: string;
      } | null;

      const customerName = profile
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown Customer'
        : 'Unknown Customer';

      return {
        id: cancel.id,
        orderId: cancel.order_id,
        orderNumber: `#${cancel.order_id.substring(0, 8).toUpperCase()}`,
        customerName,
        customerEmail: profile?.email || order?.email || 'No email',
        amount: Number(order?.amount) || 0,
        reason: cancel.reason || 'Not specified',
        refundStatus: cancel.refund_status || 'Pending',
        cancelledAt: cancel.cancelled_at,
        createdAt: order?.created_at,
      };
    });

    const totalRefunded = formattedCancellations.reduce((sum, c) => sum + c.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        cancellations: formattedCancellations,
        summary: {
          totalCancellations: formattedCancellations.length,
          totalRefundedAmount: totalRefunded,
        },
      },
    });
  }

  // Fallback: Get cancelled orders directly from orders table
  let query = supabase
    .from('orders')
    .select(`
      id,
      amount,
      created_at,
      order_status,
      email,
      profiles!orders_user_id_fkey(
        first_name,
        last_name,
        email
      )
    `)
    .eq('order_status', 'Cancelled')
    .order('created_at', { ascending: false });

  if (filters.from) {
    query = query.gte('created_at', filters.from);
  }
  if (filters.to) {
    query = query.lte('created_at', filters.to + 'T23:59:59');
  }

  const { data: orders, error } = await query;

  if (error) throw error;

  const formattedCancellations = orders?.map((order: any) => {
    const profile = order.profiles as {
      first_name?: string;
      last_name?: string;
      email?: string;
    } | null;

    const customerName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown Customer'
      : 'Unknown Customer';

    return {
      id: order.id,
      orderId: order.id,
      orderNumber: `#${order.id.substring(0, 8).toUpperCase()}`,
      customerName,
      customerEmail: profile?.email || order.email || 'No email',
      amount: Number(order.amount) || 0,
      reason: 'Not specified',
      refundStatus: 'Pending',
      cancelledAt: order.created_at,
      createdAt: order.created_at,
    };
  }) || [];

  const totalRefunded = formattedCancellations.reduce((sum, c) => sum + c.amount, 0);

  return NextResponse.json({
    success: true,
    data: {
      cancellations: formattedCancellations,
      summary: {
        totalCancellations: formattedCancellations.length,
        totalRefundedAmount: totalRefunded,
      },
    },
  });
}
