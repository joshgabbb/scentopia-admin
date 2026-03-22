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
        contact_number,
        note,
        delivery_location,
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

    // Try to get courier columns separately (they may not exist yet)
    let courierInfo = { waybill_number: null, courier_code: null, shipping_fee: null, estimated_delivery: null };
    try {
      const { data: courierData } = await supabase
        .from('orders')
        .select('waybill_number, courier_code, shipping_fee, estimated_delivery')
        .eq('id', orderId)
        .single();
      if (courierData) {
        courierInfo = courierData;
      }
    } catch (e) {
      // Courier columns don't exist yet, ignore
    }

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
    const customerPhone = order.contact_number || null;

    // Build customer address from profile (fallback)
    const addressParts = [
      profile?.street,
      profile?.barangay,
      profile?.city_municipality,
      profile?.province
    ].filter(Boolean);
    const customerAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

    // Get delivery location from order (this is what customer provided during checkout)
    const deliveryLocation = order.delivery_location as {
      address?: string;
      full_address?: string;
      shipping_fee?: number;
      // Mobile stores structured fields inside delivery_snapshot
      delivery_snapshot?: {
        full_address?: string;
        recipient_name?: string;
        recipient_phone?: string;
        street_address?: string;
        barangay?: string;
        city_municipality?: string;
        province?: string;
        region?: string;
        postal_code?: string;
        landmark?: string;
      };
      // Legacy flat fields
      recipient_name?: string;
      phone_number?: string;
      region?: { code?: string; name?: string };
      province?: { code?: string; name?: string };
      city?: { code?: string; name?: string };
      barangay?: { code?: string; name?: string };
      street_address?: string;
      postal_code?: string;
      landmarks?: string;
      latitude?: number;
      longitude?: number;
      courier_info?: {
        waybill_number?: string;
        courier_code?: string;
        courier_name?: string;
        shipping_fee?: number;
        estimated_delivery?: string;
      };
    } | null;

    // Convenience: snapshot fields (mobile's preferred format)
    const snap = deliveryLocation?.delivery_snapshot;

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

    // Build delivery address string — prefer snapshot (mobile format), then legacy
    const deliveryAddressString = snap?.full_address
      || deliveryLocation?.full_address
      || deliveryLocation?.address
      || [
          snap?.street_address || deliveryLocation?.street_address,
          snap?.barangay || (deliveryLocation?.barangay as any)?.name || (deliveryLocation?.barangay as any),
          snap?.city_municipality || (deliveryLocation?.city as any)?.name || (deliveryLocation?.city as any),
          snap?.province || (deliveryLocation?.province as any)?.name || (deliveryLocation?.province as any),
          snap?.region || (deliveryLocation?.region as any)?.name || (deliveryLocation?.region as any),
        ].filter(Boolean).join(', ')
      || customerAddress;

    const formattedOrder = {
      id: order.id,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      amount: Number(order.amount),
      status: order.order_status || 'Pending',
      createdAt: order.created_at,
      orderNumber,
      itemCount,
      note: order.note,
      // Courier/shipping info
      trackingNumber: courierInfo.waybill_number || null,
      waybillNumber: courierInfo.waybill_number || null,
      courier: courierInfo.courier_code || null,
      courierCode: courierInfo.courier_code || null,
      // Prefer delivery_location.shipping_fee (set at checkout by mobile) over post-shipment column
      shippingFee: deliveryLocation?.shipping_fee
        ? Number(deliveryLocation.shipping_fee)
        : deliveryLocation?.courier_info?.shipping_fee
        ? Number(deliveryLocation.courier_info.shipping_fee)
        : courierInfo.shipping_fee
        ? Number(courierInfo.shipping_fee)
        : null,
      estimatedDelivery: courierInfo.estimated_delivery || deliveryLocation?.courier_info?.estimated_delivery || null,
      // Delivery location from checkout
      deliveryLocation: deliveryLocation,
      deliveryAddress: deliveryAddressString,
      recipientName: snap?.recipient_name || deliveryLocation?.recipient_name || customerName,
      recipientPhone: snap?.recipient_phone || deliveryLocation?.phone_number || customerPhone,
      // Links
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
