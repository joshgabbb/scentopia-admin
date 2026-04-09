// app/api/delivery/lalamove-quote/route.ts
// Public endpoint — mobile app calls this to get a live Lalamove price at checkout.
// No auth required; only returns price, never places an order.
import { NextRequest, NextResponse } from 'next/server';
import { LalamoveService } from '@/lib/lalamove-service';

export async function POST(request: NextRequest) {
  console.log('[lalamove-quote] POST called at', new Date().toISOString());
  try {
    const body = await request.json();
    console.log('[lalamove-quote] Request body:', JSON.stringify(body));
    const { deliveryLat, deliveryLng, deliveryAddress } = body;

    if (!deliveryLat || !deliveryLng || !deliveryAddress) {
      console.error('[lalamove-quote] Missing fields:', { deliveryLat, deliveryLng, deliveryAddress });
      return NextResponse.json(
        { success: false, error: 'deliveryLat, deliveryLng, and deliveryAddress are required' },
        { status: 400 }
      );
    }

    const lat = parseFloat(deliveryLat);
    const lng = parseFloat(deliveryLng);
    if (isNaN(lat) || isNaN(lng)) {
      console.error('[lalamove-quote] Invalid coordinates:', deliveryLat, deliveryLng);
      return NextResponse.json(
        { success: false, error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    // Store pickup — Antipolo, Rizal
    const storeLat = parseFloat(process.env.LALAMOVE_STORE_LAT || '14.5851');
    const storeLng = parseFloat(process.env.LALAMOVE_STORE_LNG || '121.1762');
    const storeAddress = process.env.LALAMOVE_STORE_ADDRESS
      || 'Block 1 Lot 67, San Jose Heights, Brgy. San Jose, Antipolo City, Rizal';

    console.log('[lalamove-quote] Store:', storeLat, storeLng, storeAddress);
    console.log('[lalamove-quote] Delivery:', lat, lng, deliveryAddress);

    const lalamove = new LalamoveService();

    const quotationRequest = {
      serviceType: 'MOTORCYCLE',
      language: 'en_PH',
      stops: [
        {
          coordinates: { lat: storeLat.toString(), lng: storeLng.toString() },
          address: storeAddress,
        },
        {
          coordinates: { lat: lat.toString(), lng: lng.toString() },
          address: deliveryAddress,
        },
      ],
      item: {
        quantity: '1',
        weight: 'LESS_THAN_3KG',
        categories: ['FOOD_DELIVERY'],
        handlingInstructions: ['KEEP_UPRIGHT'],
      },
    };

    console.log('[lalamove-quote] Calling Lalamove getQuotation...');
    const quotationResult = await lalamove.getQuotation(quotationRequest);
    console.log('[lalamove-quote] Quotation result:', JSON.stringify(quotationResult));

    if (!quotationResult?.data?.quotationId) {
      console.error('[lalamove-quote] No quotationId in response:', JSON.stringify(quotationResult));
      return NextResponse.json(
        { success: false, error: 'Failed to get quotation from Lalamove' },
        { status: 400 }
      );
    }

    const priceBreakdown = quotationResult.data.priceBreakdown;
    const price = priceBreakdown?.total ?? priceBreakdown?.base ?? '0';
    const currency = priceBreakdown?.currency ?? 'PHP';

    console.log('[lalamove-quote] Success — price:', price, currency);
    return NextResponse.json({
      success: true,
      price: parseFloat(price),
      currency,
      quotationId: quotationResult.data.quotationId,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[lalamove-quote] Error:', msg);
    return NextResponse.json(
      {
        success: false,
        error: msg,
      },
      { status: 500 }
    );
  }
}
