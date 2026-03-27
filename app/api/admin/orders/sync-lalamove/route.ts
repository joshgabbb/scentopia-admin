// app/api/admin/orders/sync-lalamove/route.ts
// Manually polls Lalamove API for the latest delivery status and updates the order.
// Used in sandbox/testing when webhooks don't fire automatically.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { LalamoveService } from '@/lib/lalamove-service';

const STATUS_MAP: Record<string, { orderStatus: string; title: string; body: string } | null> = {
  ASSIGNING_DRIVER: null,
  ON_GOING:  { orderStatus: 'Shipped',   title: 'Order Picked Up',   body: 'A Lalamove driver has picked up your order and is on the way.' },
  COMPLETED: { orderStatus: 'Delivered', title: 'Order Delivered',   body: 'Your order has been delivered successfully via Lalamove.' },
  CANCELLED: { orderStatus: 'Cancelled', title: 'Delivery Cancelled', body: 'The Lalamove delivery was cancelled. Please contact support.' },
  EXPIRED:   { orderStatus: 'Cancelled', title: 'Delivery Expired',  body: 'The Lalamove delivery expired. Please contact support.' },
  REJECTED:  { orderStatus: 'Cancelled', title: 'Delivery Rejected', body: 'The Lalamove delivery was rejected. Please contact support.' },
};

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch the order to get the lalamove_order_id
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_status, delivery_location, user_id')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const lalamoveOrderId = order.delivery_location?.courier_info?.lalamove_order_id;
    if (!lalamoveOrderId) {
      return NextResponse.json({ success: false, error: 'No Lalamove order ID found on this order' }, { status: 400 });
    }

    // Fetch live status from Lalamove API
    const lalamove = new LalamoveService();
    const lalamoveData = await lalamove.makeRequest('GET', `/v3/orders/${lalamoveOrderId}`);
    const lalamoveStatus: string = lalamoveData?.data?.status;

    if (!lalamoveStatus) {
      return NextResponse.json({ success: false, error: 'Could not read status from Lalamove' }, { status: 502 });
    }

    const mapping = STATUS_MAP[lalamoveStatus];
    if (!mapping) {
      return NextResponse.json({
        success: true,
        message: `Lalamove status is ${lalamoveStatus} — no update needed`,
        lalamoveStatus,
        orderStatus: order.order_status,
      });
    }

    // Skip if already at target or further
    if (order.order_status === mapping.orderStatus ||
        order.order_status === 'Delivered' ||
        (order.order_status === 'Cancelled' && mapping.orderStatus !== 'Delivered')) {
      return NextResponse.json({
        success: true,
        message: `Order already at ${order.order_status}`,
        lalamoveStatus,
        orderStatus: order.order_status,
      });
    }

    const now = new Date().toISOString();

    await supabase.from('orders').update({
      order_status: mapping.orderStatus,
      ...(mapping.orderStatus === 'Delivered' ? { delivered_at: now } : {}),
      updated_at: now,
    }).eq('id', orderId);

    await supabase.from('order_tracking').insert({
      order_id:     orderId,
      order_status: mapping.orderStatus,
      title:        mapping.title,
      body:         mapping.body,
      created_at:   now,
    });

    // Push notification
    try {
      await supabase.from('notifications').insert({
        user_id:               order.user_id,
        notification_type:     'pending_order',
        title:                 mapping.title,
        body:                  mapping.body,
        is_read:               false,
        send_push_notification: true,
        metadata: { action: 'order-redirect', order_id: orderId },
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: `Order updated to ${mapping.orderStatus}`,
      lalamoveStatus,
      orderStatus: mapping.orderStatus,
    });

  } catch (error) {
    console.error('[sync-lalamove] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
