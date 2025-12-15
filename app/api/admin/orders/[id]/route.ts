// app/api/admin/orders/[id]/route.ts

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  try {
    const { id: orderId } = await context.params;

    const { data: order, error } = await supabase
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
          email,
          province,
          city_municipality,
          barangay,
          street
        ),
        order_items!order_items_order_id_fkey(
          quantity,
          item_amount,
          size,
          products!order_items_product_id_fkey(
            name,
            price
          )
        ),
        payments!payments_order_id_fkey(
          id,
          status,
          payment_method,
          amount,
          currency,
          created_at,
          metadata
        ),
        order_tracking!order_tracking_order_id_fkey(
          order_status,
          title,
          body,
          created_at
        )
      `)
      .eq('id', orderId)
      .single();

    if (error) {
      throw error;
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const profile = order.profiles as {
      first_name?: string;
      last_name?: string;
      email?: string;
      province?: string;
      city_municipality?: string;
      barangay?: string;
      street?: string;
    } | null;

    const customerName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown Customer'
      : 'Unknown Customer';
    
    const customerEmail = profile?.email || order.email || 'No email';

    // Build customer address
    const addressParts = [
      profile?.street,
      profile?.barangay,
      profile?.city_municipality,
      profile?.province
    ].filter(Boolean);
    const customerAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

    const itemCount = order.order_items?.reduce((sum: number, item: any) => {
      return sum + (Number(item.quantity) || 0);
    }, 0) || 0;

    const orderNumber = `#${order.id.slice(0).toUpperCase()}`;

    // Enhanced payment information
    const payment = order.payments?.[0];
    const paymentInfo = payment ? {
      paymentId: payment.id,
      paymentMethod: payment.payment_method,
      paymentStatus: payment.status,
      paymentAmount: Number(payment.amount || order.amount),
      currency: payment.currency || 'PHP',
      paymentCreatedAt: payment.created_at,
      paymentMetadata: payment.metadata
    } : null;

    // Order tracking history
    const trackingHistory = order.order_tracking?.map((track: any) => ({
      status: track.order_status,
      title: track.title,
      body: track.body,
      created_at: track.created_at
    })) || [];

    const formattedOrder = {
      id: order.id,
      customerName,
      customerEmail,
      customerPhone: null, // Add phone to profiles table if needed
      customerAddress,
      amount: Number(order.amount),
      status: order.order_status || 'Pending',
      createdAt: order.created_at,
      orderNumber,
      itemCount,
      note: order.note,
      trackingNumber: null, // Will be populated when shipping is created
      courier: null, // Will be populated when shipping is created
      paymentLink: `https://balidining.me/order/${order.id}`,
      payment: paymentInfo,
      trackingHistory,
      items: order.order_items?.map((item: any) => ({
        id: item.id,
        productName: item.products?.name || 'Unknown Product',
        quantity: Number(item.quantity),
        size: item.size,
        price: Number(item.products?.price || 0),
        itemAmount: Number(item.item_amount)
      })) || []
    };

    return NextResponse.json({
      success: true,
      data: formattedOrder
    });

  } catch (error) {
    console.error('Order details API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch order details',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
