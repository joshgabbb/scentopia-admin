import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
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

    // Update the order - only use fields that exist
    // Store all courier info in delivery_location JSON to avoid missing column errors
    const updateData: any = {
      order_status: 'Shipped',
      updated_at: new Date().toISOString(),
      delivery_location: updatedDeliveryLocation
    };

    // Try to add courier columns if they exist
    try {
      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({
          ...updateData,
          waybill_number: waybillNumber,
          courier_code: courierCode || 'JNT',
          shipping_fee: shippingFee,
          estimated_delivery: estimatedDelivery,
        })
        .eq('id', orderId)
        .select()
        .single();

      if (updateError) {
        // If courier columns don't exist, try without them
        console.log('Trying update without courier columns...');
        const { error: fallbackError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', orderId);

        if (fallbackError) {
          console.error('Error updating order:', fallbackError);
          return NextResponse.json(
            { success: false, error: 'Failed to update order status' },
            { status: 500 }
          );
        }
      }
    } catch (e) {
      // Fallback: update only basic fields
      const { error: fallbackError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (fallbackError) {
        console.error('Error updating order (fallback):', fallbackError);
        return NextResponse.json(
          { success: false, error: 'Failed to update order status' },
          { status: 500 }
        );
      }
    }

    // Create order tracking entry (optional - may fail due to RLS)
    try {
      await supabase
        .from('order_tracking')
        .insert({
          order_id: orderId,
          order_status: 'Shipped',
          title: 'Order Shipped via J&T Express',
          body: `Your order has been shipped! Tracking number: ${waybillNumber}. Expected delivery: ${new Date(estimatedDelivery).toLocaleDateString('en-PH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}`,
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
          title: 'Order Shipped!',
          body: `Your order has been shipped via J&T Express. Track with: ${waybillNumber}`,
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
        body: { order_id: orderId, status: 'Shipped' },
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
        status: 'Shipped',
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
