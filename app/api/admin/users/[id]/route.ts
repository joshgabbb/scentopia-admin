// app/api/admin/users/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  try {
    const { id: userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log('👤 Fetching user details:', userId);

    // Get user profile - only select columns that exist
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone
      `)
      .eq('id', userId)
      .single();

    if (userError) {
      if (userError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }
      throw userError;
    }

    // Get user's orders with order items
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        amount,
        order_status,
        created_at,
        email,
        note,
        order_items!order_items_order_id_fkey(
          id,
          quantity,
          item_amount,
          size,
          products(
            id,
            name,
            price
          )
        ),
        payments!payments_order_id_fkey(
          id,
          payment_method,
          status,
          amount,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('❌ Orders fetch error:', ordersError);
    }

    // Calculate statistics
    const orderCount = orders?.length || 0;
    const totalSpent = orders?.reduce((sum, order) => sum + (Number(order.amount) || 0), 0) || 0;
    const averageOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;

    // Get order status breakdown
    const statusBreakdown: Record<string, number> = {};
    orders?.forEach(order => {
      const status = order.order_status || 'Unknown';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });

    // Format orders
    const formattedOrders = orders?.map(order => {
      const payment = Array.isArray(order.payments) ? order.payments[0] : order.payments;

      return {
        id: order.id,
        orderNumber: `#${order.id.substring(0, 8).toUpperCase()}`,
        amount: Number(order.amount),
        status: order.order_status || 'Pending',
        createdAt: order.created_at,
        itemCount: order.order_items?.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0) || 0,
        items: order.order_items?.map((item: any) => ({
          id: item.id,
          productName: item.products?.name || 'Unknown Product',
          quantity: Number(item.quantity),
          size: item.size,
          itemAmount: Number(item.item_amount)
        })) || [],
        payment: payment ? {
          method: payment.payment_method,
          status: payment.status,
          amount: Number(payment.amount)
        } : null
      };
    }) || [];

    console.log('✅ User details fetched successfully');

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          firstName: user.first_name || '',
          lastName: user.last_name || '',
          email: user.email || '',
          phone: user.phone || '',
          isActive: true,
          createdAt: null,
          updatedAt: null
        },
        stats: {
          orderCount,
          totalSpent,
          averageOrderValue,
          statusBreakdown
        },
        orders: formattedOrders
      }
    });

  } catch (error) {
    console.error('❌ User details API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user details',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
