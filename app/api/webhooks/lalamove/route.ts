// app/api/webhooks/lalamove/route.ts
// Receives delivery status updates from Lalamove partner portal
// Register this URL in Lalamove Partner Portal → Settings → Webhooks:
//   https://your-domain.com/api/webhooks/lalamove

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Map Lalamove statuses to Scentopia order statuses
const STATUS_MAP: Record<string, { orderStatus: string; title: string; body: string } | null> = {
  ASSIGNING_DRIVER: null, // no update needed
  ON_GOING:   { orderStatus: 'Shipped',   title: 'Order Picked Up',  body: 'A Lalamove driver has picked up your order and is on the way.' },
  COMPLETED:  { orderStatus: 'Delivered', title: 'Order Delivered',  body: 'Your order has been delivered successfully via Lalamove.' },
  CANCELLED:  { orderStatus: 'Cancelled', title: 'Delivery Cancelled', body: 'The Lalamove delivery was cancelled. Please contact support.' },
  EXPIRED:    { orderStatus: 'Cancelled', title: 'Delivery Expired',  body: 'The Lalamove delivery expired. Please contact support.' },
  REJECTED:   { orderStatus: 'Cancelled', title: 'Delivery Rejected', body: 'The Lalamove delivery was rejected. Please contact support.' },
};

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.LALAMOVE_API_SECRET;
  if (!secret || !signatureHeader) return false;

  // Lalamove signs webhook body with HMAC-SHA256 using the API secret
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  // Header may be prefixed with "hmac " — strip it
  const received = signatureHeader.replace(/^hmac\s+/i, '');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify webhook signature to ensure it's from Lalamove
    const signature = request.headers.get('X-LLM-Signature')
      ?? request.headers.get('x-llm-signature')
      ?? request.headers.get('X-Lalamove-Signature');

    if (!verifySignature(rawBody, signature)) {
      console.warn('[Lalamove Webhook] Invalid or missing signature');
      // In development you may want to allow unsigned webhooks for testing
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    console.log('[Lalamove Webhook] Received:', JSON.stringify(payload, null, 2));

    // Lalamove sends: { orderId, status, shareLink, driverId, ... }
    const lalamoveOrderId: string = payload.orderId ?? payload.data?.orderId;
    const lalamoveStatus: string  = payload.status  ?? payload.data?.status;

    if (!lalamoveOrderId || !lalamoveStatus) {
      console.warn('[Lalamove Webhook] Missing orderId or status in payload');
      return NextResponse.json({ received: true });
    }

    const mapping = STATUS_MAP[lalamoveStatus];
    if (!mapping) {
      // Status we don't act on (e.g. ASSIGNING_DRIVER)
      console.log(`[Lalamove Webhook] No action for status: ${lalamoveStatus}`);
      return NextResponse.json({ received: true });
    }

    const supabase = createAdminClient();

    // Find the Scentopia order by Lalamove order ID stored in delivery_location.courier_info
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_status, delivery_location')
      .filter('delivery_location->courier_info->>lalamove_order_id', 'eq', lalamoveOrderId);

    if (error || !orders?.length) {
      console.warn(`[Lalamove Webhook] No order found for lalamove_order_id: ${lalamoveOrderId}`);
      return NextResponse.json({ received: true });
    }

    const order = orders[0];

    // Skip if order is already in the target status or further along
    const skipStatuses = ['Delivered', 'Cancelled'];
    if (skipStatuses.includes(order.order_status) && mapping.orderStatus !== 'Delivered') {
      console.log(`[Lalamove Webhook] Order ${order.id} already at ${order.order_status}, skipping`);
      return NextResponse.json({ received: true });
    }

    const now = new Date().toISOString();

    // Update order status
    await supabase
      .from('orders')
      .update({
        order_status: mapping.orderStatus,
        ...(mapping.orderStatus === 'Delivered' ? { delivered_at: now } : {}),
        updated_at: now,
      })
      .eq('id', order.id);

    // Insert order_tracking entry so timeline updates in admin and mobile
    await supabase.from('order_tracking').insert({
      order_id:     order.id,
      order_status: mapping.orderStatus,
      title:        mapping.title,
      body:         mapping.body,
      created_at:   now,
    });

    // Send push notification to customer
    try {
      const { data: orderFull } = await supabase
        .from('orders')
        .select('user_id')
        .eq('id', order.id)
        .single();

      if (orderFull?.user_id) {
        await supabase.from('notifications').insert({
          user_id:               orderFull.user_id,
          notification_type:     'pending_order',
          title:                 mapping.title,
          body:                  mapping.body,
          is_read:               false,
          send_push_notification: true,
          metadata: {
            action:   'order-redirect',
            order_id: order.id,
          },
        });
      }
    } catch (notifError) {
      console.error('[Lalamove Webhook] Failed to send notification:', notifError);
      // Non-critical — order status is already updated
    }

    console.log(`[Lalamove Webhook] Order ${order.id} updated to ${mapping.orderStatus}`);
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[Lalamove Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
