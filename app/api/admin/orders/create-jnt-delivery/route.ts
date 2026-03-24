import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    const body = await request.json();

    const {
      orderId,
      waybillNumber,
      courierCode,
      courierName,
      shippingFee,
      estimatedDelivery,
      recipientInfo,
      packageWeight,
      notes,
      zone,
    } = body;

    // Validate required fields
    if (!orderId || !waybillNumber || !shippingFee) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: orderId, waybillNumber, shippingFee' },
        { status: 400 }
      );
    }

    // Fetch the order to validate it exists
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_status, user_id, delivery_location')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check payment — cannot ship an unpaid order
    const { data: payment } = await supabase
      .from('payments')
      .select('status')
      .eq('order_id', orderId)
      .maybeSingle();

    const isPaid = payment?.status?.toLowerCase() === 'paid' || payment?.status?.toLowerCase() === 'completed';
    if (!isPaid) {
      return NextResponse.json(
        { success: false, error: 'Order must be paid before it can be shipped.' },
        { status: 400 }
      );
    }

    // Check if order is in a valid status for shipping
    // Only allow shipping when admin has explicitly processed the order first
    if (order.order_status !== 'Processing') {
      return NextResponse.json(
        { success: false, error: `Order must be in Processing status before shipping. Current status: ${order.order_status}` },
        { status: 400 }
      );
    }

    // Build updated delivery_location with courier info
    const existingDeliveryLocation = order.delivery_location || {};
    const updatedDeliveryLocation = {
      ...existingDeliveryLocation,
      courier_info: {
        waybill_number: waybillNumber,
        courier_code: courierCode || 'JNT',
        courier_name: courierName || 'J&T Express',
        shipping_fee: shippingFee,
        estimated_delivery: estimatedDelivery,
        package_weight: packageWeight,
        zone: zone,
        notes: notes,
        shipped_at: new Date().toISOString(),
      }
    };

    // Update order status and store all courier info inside delivery_location JSONB
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        order_status: 'To Ship',
        delivery_location: updatedDeliveryLocation,
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    // Create order tracking entry (optional - may fail due to RLS)
    try {
      await supabase
        .from('order_tracking')
        .insert({
          order_id: orderId,
          order_status: 'To Ship',
          title: 'Waybill Created — Ready to Hand Off',
          body: `Your order has been packed and a waybill has been created. Tracking number: ${waybillNumber}. We will hand the package to J&T Express soon.`,
        });
    } catch (trackingError) {
      console.log('Tracking entry creation skipped (RLS or missing table):', trackingError);
      // Non-critical, continue
    }

    // Send notification to customer (if notification system exists)
    try {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: order.user_id,
          title: '📦 Your Order is Packed!',
          body: `Your order is packed and ready to be handed to J&T Express. Tracking number: ${waybillNumber}`,
          type: 'order_update',
          data: {
            order_id: orderId,
            waybill_number: waybillNumber,
            tracking_url: `https://www.jtexpress.ph/index/query/gzquery.html?waybillnumber=${waybillNumber}`,
          },
        });

      if (notifError) {
        console.log('Notification error (non-critical):', notifError);
      }
    } catch (notifErr) {
      // Notification is non-critical
      console.log('Notification system may not be available');
    }

    // Send Shipped status email (non-critical)
    try {
      await supabase.functions.invoke('send-status-email', {
        body: { order_id: orderId, status: 'To Ship' },
      });
    } catch {
      // Non-critical, continue
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        waybillNumber,
        courierCode: courierCode || 'JNT',
        courierName: courierName || 'J&T Express',
        shippingFee,
        estimatedDelivery,
        status: 'To Ship',
        trackingUrl: `https://www.jtexpress.ph/index/query/gzquery.html?waybillnumber=${waybillNumber}`,
      }
    });

  } catch (error) {
    console.error('Error creating J&T delivery:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Get shipping rates
  const shippingRates = {
    METRO_MANILA: { baseFee: 85, estimatedDays: '2-3', label: 'Metro Manila' },
    LUZON: { baseFee: 115, estimatedDays: '3-5', label: 'Luzon (Provincial)' },
    VISAYAS: { baseFee: 150, estimatedDays: '5-7', label: 'Visayas' },
    MINDANAO: { baseFee: 170, estimatedDays: '5-7', label: 'Mindanao' },
  };

  return NextResponse.json({
    success: true,
    data: {
      courier: {
        code: 'JNT',
        name: 'J&T Express',
      },
      rates: shippingRates,
      weightFeePerHalfKg: 20,
      baseWeight: 0.5, // First 500g included in base fee
    }
  });
}
