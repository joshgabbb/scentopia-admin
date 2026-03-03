// app/api/admin/reports/customers/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'list'; // list | top | orders
    const limit = parseInt(searchParams.get('limit') || '50');
    const customerId = searchParams.get('customerId');

    console.log('📊 Customers Report API called with params:', { type, limit, customerId });

    if (type === 'top') {
      return await getTopCustomersReport(supabase, limit);
    } else if (type === 'orders' && customerId) {
      return await getCustomerOrdersReport(supabase, customerId);
    } else {
      return await getCustomerListReport(supabase, limit);
    }
  } catch (error) {
    console.error('❌ Customers Report API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch customers report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function getCustomerListReport(supabase: any, limit: number) {
  // Get all profiles with their orders
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      email,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (profilesError) throw profilesError;

  // Get orders for all users
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('user_id, amount, created_at, order_status')
    .not('order_status', 'eq', 'Cancelled');

  if (ordersError) throw ordersError;

  // Aggregate orders by user
  const ordersByUser: Record<string, { count: number; total: number; lastOrder: string }> = {};
  orders?.forEach((order: any) => {
    const userId = order.user_id;
    if (!ordersByUser[userId]) {
      ordersByUser[userId] = { count: 0, total: 0, lastOrder: '' };
    }
    ordersByUser[userId].count += 1;
    ordersByUser[userId].total += Number(order.amount) || 0;
    if (!ordersByUser[userId].lastOrder || order.created_at > ordersByUser[userId].lastOrder) {
      ordersByUser[userId].lastOrder = order.created_at;
    }
  });

  const customers = profiles?.map((profile: any) => {
    const userOrders = ordersByUser[profile.id] || { count: 0, total: 0, lastOrder: '' };

    return {
      id: profile.id,
      name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown',
      email: profile.email || 'No email',
      orderCount: userOrders.count,
      totalSpent: userOrders.total,
      averageOrderValue: userOrders.count > 0 ? userOrders.total / userOrders.count : 0,
      lastOrderDate: userOrders.lastOrder
        ? new Date(userOrders.lastOrder).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Never',
      joinedDate: new Date(profile.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    };
  }) || [];

  const totalOrders = customers.reduce((sum, c) => sum + c.orderCount, 0);
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const customersWithOrders = customers.filter(c => c.orderCount > 0).length;

  return NextResponse.json({
    success: true,
    data: {
      customers,
      summary: {
        totalCustomers: customers.length,
        customersWithOrders,
        totalOrders,
        totalRevenue,
        averageOrdersPerCustomer: customers.length > 0 ? totalOrders / customers.length : 0,
      },
    },
  });
}

async function getTopCustomersReport(supabase: any, limit: number) {
  // Get all orders with user info
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`
      user_id,
      amount,
      created_at,
      order_status,
      profiles!orders_user_id_fkey(
        first_name,
        last_name,
        email
      )
    `)
    .not('order_status', 'eq', 'Cancelled');

  if (ordersError) throw ordersError;

  // Aggregate by user
  const customerStats: Record<string, {
    name: string;
    email: string;
    orderCount: number;
    totalSpent: number;
    lastOrder: string;
  }> = {};

  orders?.forEach((order: any) => {
    const userId = order.user_id;
    const profile = order.profiles as { first_name?: string; last_name?: string; email?: string } | null;

    if (!customerStats[userId]) {
      customerStats[userId] = {
        name: profile
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
          : 'Unknown',
        email: profile?.email || 'No email',
        orderCount: 0,
        totalSpent: 0,
        lastOrder: '',
      };
    }

    customerStats[userId].orderCount += 1;
    customerStats[userId].totalSpent += Number(order.amount) || 0;
    if (!customerStats[userId].lastOrder || order.created_at > customerStats[userId].lastOrder) {
      customerStats[userId].lastOrder = order.created_at;
    }
  });

  // Sort by total spent and take top N
  const topCustomers = Object.entries(customerStats)
    .map(([id, stats]) => ({
      id,
      ...stats,
      averageOrderValue: stats.orderCount > 0 ? stats.totalSpent / stats.orderCount : 0,
      lastOrderDate: stats.lastOrder
        ? new Date(stats.lastOrder).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Never',
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);

  const totalSpent = topCustomers.reduce((sum, c) => sum + c.totalSpent, 0);
  const totalOrders = topCustomers.reduce((sum, c) => sum + c.orderCount, 0);

  return NextResponse.json({
    success: true,
    data: {
      customers: topCustomers,
      summary: {
        customersShown: topCustomers.length,
        combinedSpending: totalSpent,
        combinedOrders: totalOrders,
        averageSpendingPerCustomer: topCustomers.length > 0 ? totalSpent / topCustomers.length : 0,
      },
    },
  });
}

async function getCustomerOrdersReport(supabase: any, customerId: string) {
  // Get customer profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .eq('id', customerId)
    .single();

  if (profileError) throw profileError;

  // Get customer's orders
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`
      id,
      amount,
      created_at,
      order_status,
      order_items!order_items_order_id_fkey(
        quantity,
        item_amount,
        products!order_items_product_id_fkey(
          name
        )
      ),
      payments!payments_order_id_fkey(
        status,
        payment_method
      )
    `)
    .eq('user_id', customerId)
    .order('created_at', { ascending: false });

  if (ordersError) throw ordersError;

  const formattedOrders = orders?.map((order: any) => {
    const payment = Array.isArray(order.payments) ? order.payments[0] : order.payments;
    const itemCount = order.order_items?.reduce(
      (sum: number, item: any) => sum + (Number(item.quantity) || 0),
      0
    ) || 0;

    return {
      id: order.id,
      orderNumber: `#${order.id.substring(0, 8).toUpperCase()}`,
      amount: Number(order.amount) || 0,
      status: order.order_status || 'Pending',
      paymentStatus: payment?.status || 'N/A',
      paymentMethod: payment?.payment_method || 'N/A',
      itemCount,
      date: new Date(order.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      items: order.order_items?.map((item: any) => ({
        name: item.products?.name || 'Unknown Product',
        quantity: Number(item.quantity) || 0,
        amount: Number(item.item_amount) || 0,
      })) || [],
    };
  }) || [];

  const totalSpent = formattedOrders
    .filter(o => o.status !== 'Cancelled')
    .reduce((sum, o) => sum + o.amount, 0);

  return NextResponse.json({
    success: true,
    data: {
      customer: {
        id: profile.id,
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown',
        email: profile.email || 'No email',
      },
      orders: formattedOrders,
      summary: {
        totalOrders: formattedOrders.length,
        totalSpent,
        averageOrderValue: formattedOrders.length > 0 ? totalSpent / formattedOrders.length : 0,
      },
    },
  });
}
