// app/api/admin/orders/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    const statusFilter = searchParams.get('status') || 'all';
    const paymentStatusFilter = searchParams.get('payment_status') || 'all';
    const limit = 25;
    const offset = (page - 1) * limit;

    console.log('📊 Orders API called with params:', {
      page, search, sortBy, sortOrder, statusFilter, paymentStatusFilter
    });

    // Build the base query with payment information
    let query = supabase
      .from('orders')
      .select(`
        id,
        amount,
        created_at,
        order_status,
        email,
        note,
        profiles!orders_user_id_fkey(
          first_name,
          last_name,
          email
        ),
        order_items!order_items_order_id_fkey(
          quantity,
          item_amount,
          size,
          products(
            name
          )
        ),
        payments!payments_order_id_fkey(
          id,
          payment_method,
          status,
          amount,
          currency,
          created_at,
          metadata
        )
      `, { count: 'exact' });

    // Apply search filter (only on order email for now)
    if (search) {
      query = query.or(`email.ilike.%${search}%`);
    }

    // Apply order status filter
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('order_status', statusFilter);
    }

    // Apply sorting
    if (sortBy === 'created_at' || sortBy === 'orders.created_at') {
      query = query.order('created_at', { ascending: sortOrder === 'asc' });
    } else if (sortBy === 'amount') {
      query = query.order('amount', { ascending: sortOrder === 'asc' });
    } else {
      query = query.order('created_at', { ascending: sortOrder === 'asc' });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: orders, error, count } = await query;

    if (error) {
      console.error('❌ Supabase query error:', error);
      throw error;
    }

    console.log('✅ Query successful, orders count:', orders?.length);

    // Format the orders data
    let formattedOrders = orders?.map(order => {
      const profile = order.profiles as {
        first_name?: string;
        last_name?: string;
        email?: string;
      } | null;

      const customerName = profile
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown Customer'
        : 'Unknown Customer';

      const customerEmail = profile?.email || order.email || 'No email';

      const itemCount = order.order_items?.reduce((sum: number, item: any) => {
        return sum + (Number(item.quantity) || 0);
      }, 0) || 0;

      const payment = Array.isArray(order.payments) ? order.payments[0] : order.payments;
      const paymentInfo = payment ? {
        paymentId: payment.id,
        paymentMethod: payment.payment_method,
        paymentStatus: payment.status,
        paymentAmount: Number(payment.amount),
        currency: payment.currency,
        paymentCreatedAt: payment.created_at,
        paymentMetadata: payment.metadata
      } : null;

      const orderNumber = `#${order.id.substring(0, 8).toUpperCase()}`;

      return {
        id: order.id,
        customerName,
        customerEmail,
        amount: Number(order.amount),
        status: order.order_status || 'Pending',
        createdAt: order.created_at,
        orderNumber,
        itemCount,
        payment: paymentInfo,
        items: order.order_items?.map((item: any) => ({
          quantity: Number(item.quantity),
          itemAmount: Number(item.item_amount),
          size: item.size,
          productName: item.products?.name
        })) || []
      };
    }) || [];

    // Filter by search term after formatting
    if (search && formattedOrders.length > 0) {
      const searchLower = search.toLowerCase();
      formattedOrders = formattedOrders.filter(order => 
        order.customerName.toLowerCase().includes(searchLower) ||
        order.customerEmail.toLowerCase().includes(searchLower) ||
        order.orderNumber.toLowerCase().includes(searchLower)
      );
    }

    // Filter by payment status after formatting
    if (paymentStatusFilter && paymentStatusFilter !== 'all' && formattedOrders.length > 0) {
      formattedOrders = formattedOrders.filter(order => 
        order.payment?.paymentStatus?.toLowerCase() === paymentStatusFilter.toLowerCase()
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    console.log('✅ Returning formatted orders:', formattedOrders.length);

    return NextResponse.json({
      success: true,
      data: {
        orders: formattedOrders,
        totalCount: count || 0,
        totalPages,
        currentPage: page
      }
    });

  } catch (error) {
    console.error('❌ Orders API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch orders',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('id');
    
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, paymentStatus, ...updateData } = body;

    console.log('📝 Updating order:', orderId, { status, paymentStatus });

    // Update the order status
    if (status) {
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          order_status: status,
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select();

      if (orderError) {
        throw orderError;
      }
    }

    // Update payment status if provided
    if (paymentStatus) {
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          status: paymentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('order_id', orderId)
        .select();

      if (paymentError) {
        throw paymentError;
      }
    }

    // Get updated order data
    const { data: updatedOrder, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id,
        order_status,
        updated_at,
        payments!payments_order_id_fkey(
          status,
          updated_at
        )
      `)
      .eq('id', orderId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    const paymentsArray = Array.isArray(updatedOrder.payments) 
      ? updatedOrder.payments 
      : updatedOrder.payments ? [updatedOrder.payments] : [];

    return NextResponse.json({
      success: true,
      data: {
        id: updatedOrder.id,
        status: updatedOrder.order_status,
        updatedAt: updatedOrder.updated_at,
        payment: paymentsArray.length > 0 ? {
          status: paymentsArray[0].status,
          updatedAt: paymentsArray[0].updated_at
        } : null
      }
    });

  } catch (error) {
    console.error('❌ Order update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update order',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('id');
    
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    console.log('🗑️ Deleting order:', orderId);

    // Delete in correct order due to foreign key constraints
    // 1. First delete reviews (if they reference order_items)
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id')
      .eq('order_id', orderId);

    if (orderItems && orderItems.length > 0) {
      await supabase
        .from('reviews')
        .delete()
        .in('order_item_id', orderItems.map(item => item.id));
    }

    // 2. Delete order_items
    await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    // 3. Delete payments
    await supabase
      .from('payments')
      .delete()
      .eq('order_id', orderId);

    // 4. Delete order tracking
    await supabase
      .from('order_tracking')
      .delete()
      .eq('order_id', orderId);

    // 5. Delete cancelled_orders if exists
    await supabase
      .from('cancelled_orders')
      .delete()
      .eq('order_id', orderId);

    // 6. Finally delete the order
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      throw error;
    }

    console.log('✅ Order deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Order and related data deleted successfully'
    });

  } catch (error) {
    console.error('❌ Order deletion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete order',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}