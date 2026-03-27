// app/api/admin/orders/create-delivery/route.ts
import { NextRequest, NextResponse } from "next/server";
import { LalamoveService } from '@/lib/lalamove-service';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  console.log('=== CREATE DELIVERY ENDPOINT CALLED ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    // Step 1: Parse request body
    console.log('Step 1: Parsing request body...');
    const body = await request.json();
    console.log('✓ Request body parsed successfully:', JSON.stringify(body, null, 2));

    const { 
      orderId, 
      pickupAddress, 
      deliveryAddress, 
      senderInfo, 
      recipientInfo,
      serviceType = 'MOTORCYCLE',
      scheduleAt,
      specialRequests = [],
      notes
    } = body;

    console.log('Step 2: Extracted fields:');
    console.log('- orderId:', orderId);
    console.log('- pickupAddress:', JSON.stringify(pickupAddress, null, 2));
    console.log('- deliveryAddress:', JSON.stringify(deliveryAddress, null, 2));
    console.log('- senderInfo:', JSON.stringify(senderInfo, null, 2));
    console.log('- recipientInfo:', JSON.stringify(recipientInfo, null, 2));
    console.log('- serviceType:', serviceType);
    console.log('- scheduleAt:', scheduleAt);
    console.log('- specialRequests:', specialRequests);
    console.log('- notes:', notes);

    // Step 3: Validate required fields — pickupAddress & senderInfo fall back to env vars
    console.log('Step 3: Validating required fields...');

    // Fall back to store env vars if pickup/sender not provided
    const resolvedPickup = pickupAddress ?? {
      lat: parseFloat(process.env.LALAMOVE_STORE_LAT || '14.5851'),
      lng: parseFloat(process.env.LALAMOVE_STORE_LNG || '121.1762'),
      address: process.env.LALAMOVE_STORE_ADDRESS
        || 'Block 1 Lot 67, San Jose Heights, Brgy. San Jose, Antipolo City, Rizal',
    };
    const resolvedSender = senderInfo ?? {
      name: process.env.LALAMOVE_SENDER_NAME || 'Scentopia',
      phone: process.env.LALAMOVE_SENDER_PHONE || '+63000000000',
    };

    if (!orderId || !deliveryAddress || !recipientInfo) {
      console.error('✗ Missing required fields');
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: orderId, deliveryAddress, recipientInfo'
        },
        { status: 400 }
      );
    }
    console.log('✓ Required fields validation passed');

    // Step 4: Validate coordinates
    console.log('Step 4: Validating coordinates...');
    if (!resolvedPickup.lat || !resolvedPickup.lng || !deliveryAddress.lat || !deliveryAddress.lng) {
      console.error('✗ Missing coordinates');
      console.error('- pickup lat/lng:', resolvedPickup.lat, resolvedPickup.lng);
      console.error('- delivery lat/lng:', deliveryAddress.lat, deliveryAddress.lng);

      return NextResponse.json(
        {
          success: false,
          error: 'Missing coordinates in pickup or delivery address'
        },
        { status: 400 }
      );
    }
    console.log('✓ Coordinates validation passed');

    // Step 5: Validate phone numbers
    console.log('Step 5: Validating phone numbers...');
    if (!resolvedSender.phone?.startsWith('+') || !recipientInfo.phone?.startsWith('+')) {
      console.error('✗ Invalid phone number format');
      console.error('- sender phone:', resolvedSender.phone);
      console.error('- recipient phone:', recipientInfo.phone);
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Phone numbers must include country code (e.g., +63912345678)' 
        },
        { status: 400 }
      );
    }
    console.log('✓ Phone numbers validation passed');

    // Step 6: Initialize Lalamove service
    console.log('Step 6: Initializing Lalamove service...');
    let lalamove;
    try {
      lalamove = new LalamoveService();
      console.log('✓ Lalamove service initialized successfully');
    } catch (initError) {
      console.error('✗ Failed to initialize Lalamove service:', initError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to initialize Lalamove service',
          details: initError instanceof Error ? initError.message : 'Unknown initialization error'
        },
        { status: 500 }
      );
    }
    
    // Step 7: Prepare quotation request
    console.log('Step 7: Preparing quotation request...');
    const totalItems = 1;

    const quotationRequest = {
      serviceType,
      language: 'en_PH',
      stops: [
        {
          coordinates: {
            lat: resolvedPickup.lat.toString(),
            lng: resolvedPickup.lng.toString()
          },
          address: resolvedPickup.address
        },
        {
          coordinates: {
            lat: deliveryAddress.lat.toString(),
            lng: deliveryAddress.lng.toString()
          },
          address: deliveryAddress.address
        }
      ],
      item: {
        quantity: totalItems.toString(),
        weight: "LESS_THAN_3KG",
        categories: ["FOOD_DELIVERY"],
        handlingInstructions: ["KEEP_UPRIGHT"]
      },
      // Only include scheduleAt if provided and valid
      ...(scheduleAt && { scheduleAt }),
      // Only include specialRequests if not empty
      ...(specialRequests.length > 0 && { specialRequests })
    };

    console.log('✓ Quotation request prepared:', JSON.stringify(quotationRequest, null, 2));

    // Step 8: Get Lalamove quotation
    console.log('Step 8: Requesting quotation from Lalamove...');
    let quotationResult;
    try {
      quotationResult = await lalamove.getQuotation(quotationRequest);
      console.log('✓ Quotation received:', JSON.stringify(quotationResult, null, 2));
    } catch (quotationError) {
      console.error('✗ Quotation request failed:', quotationError);
      console.error('Error type:', quotationError instanceof Error ? quotationError.constructor.name : typeof quotationError);
      console.error('Error message:', quotationError instanceof Error ? quotationError.message : String(quotationError));
      console.error('Error stack:', quotationError instanceof Error ? quotationError.stack : 'No stack trace');
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to get delivery quotation',
          details: quotationError instanceof Error ? quotationError.message : String(quotationError),
          errorType: 'QuotationError'
        },
        { status: 400 }
      );
    }
    
    if (!quotationResult?.data?.quotationId) {
      console.error('✗ Invalid quotation response - missing quotation ID');
      console.error('Response structure:', Object.keys(quotationResult || {}));
      console.error('Data structure:', Object.keys(quotationResult?.data || {}));
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to get delivery quotation - no quotation ID returned',
          details: quotationResult,
          errorType: 'InvalidQuotationResponse'
        },
        { status: 400 }
      );
    }

    const quotationId = quotationResult.data.quotationId;
    const stops = quotationResult.data.stops;
    console.log('✓ Quotation ID:', quotationId);
    console.log('✓ Stops:', JSON.stringify(stops, null, 2));

    if (!stops || stops.length < 2) {
      console.error('✗ Invalid stops in quotation response');
      console.error('Stops array:', stops);
      console.error('Stops length:', stops?.length);
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid stops returned from quotation',
          details: { quotationResult, stopsReceived: stops },
          errorType: 'InvalidStopsResponse'
        },
        { status: 400 }
      );
    }

    // Step 9: Place Lalamove order
    console.log('Step 9: Preparing order request...');
    const orderRequest = {
      quotationId,
      sender: {
        stopId: stops[0].stopId,
        name: resolvedSender.name,
        phone: resolvedSender.phone
      },
      recipients: [
        {
          stopId: stops[1].stopId,
          name: recipientInfo.name,
          phone: recipientInfo.phone,
          remarks: notes || `Order #${orderId}`
        }
      ],
      isPODEnabled: false,
      partner: process.env.LALAMOVE_SENDER_NAME || 'Scentopia',
      metadata: {
        orderId: orderId,
      }
    };

    console.log('✓ Order request prepared:', JSON.stringify(orderRequest, null, 2));

    console.log('Step 10: Placing order with Lalamove...');
    let lalamoveOrder;
    try {
      lalamoveOrder = await lalamove.placeOrder(orderRequest);
      console.log('✓ Order placed successfully:', JSON.stringify(lalamoveOrder, null, 2));
    } catch (orderError) {
      console.error('✗ Order placement failed:', orderError);
      console.error('Error type:', orderError instanceof Error ? orderError.constructor.name : typeof orderError);
      console.error('Error message:', orderError instanceof Error ? orderError.message : String(orderError));
      console.error('Error stack:', orderError instanceof Error ? orderError.stack : 'No stack trace');
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to place delivery order',
          details: orderError instanceof Error ? orderError.message : String(orderError),
          errorType: 'OrderPlacementError'
        },
        { status: 400 }
      );
    }

    if (!lalamoveOrder?.data?.orderId) {
      console.error('✗ Invalid order response - missing order ID');
      console.error('Response structure:', Object.keys(lalamoveOrder || {}));
      console.error('Data structure:', Object.keys(lalamoveOrder?.data || {}));
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create delivery order - no order ID returned',
          details: lalamoveOrder,
          errorType: 'InvalidOrderResponse'
        },
        { status: 400 }
      );
    }

    const shareLink = lalamoveOrder.data.shareLink || '';
    const deliveryAmount = lalamoveOrder.data.priceBreakdown?.total || 'N/A';
    const deliveryCurrency = lalamoveOrder.data.priceBreakdown?.currency || 'PHP';

    // Step 11: Persist Lalamove order details to orders table
    console.log('Step 11: Saving Lalamove order details to database...');
    try {
      const supabase = createAdminClient();
      const { data: currentOrder } = await supabase
        .from('orders')
        .select('delivery_location, user_id')
        .eq('id', orderId)
        .single();

      const updatedDeliveryLocation = {
        ...(currentOrder?.delivery_location || {}),
        courier_info: {
          courier_code: 'LALAMOVE',
          courier_name: 'Lalamove',
          lalamove_order_id: lalamoveOrder.data.orderId,
          quotation_id: quotationId,
          tracking_url: shareLink,
          delivery_amount: deliveryAmount,
          currency: deliveryCurrency,
          shipped_at: new Date().toISOString(),
        },
      };

      await supabase
        .from('orders')
        .update({
          courier_provider: 'lalamove',
          delivery_location: updatedDeliveryLocation,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      console.log('✓ Lalamove order details saved to database');
    } catch (dbError) {
      // Non-critical — delivery was placed, just log the DB error
      console.error('⚠️ Failed to save Lalamove details to DB:', dbError);
    }

    console.log('Step 12: Preparing success response...');
    const successResponse = {
      success: true,
      data: {
        lalamoveOrderId: lalamoveOrder.data.orderId,
        quotationId: quotationId,
        shareLink,
        deliveryAmount,
        currency: deliveryCurrency,
        estimatedDeliveryTime: quotationResult.data.scheduleAt,
        driverId: lalamoveOrder.data.driverId || '',
        status: lalamoveOrder.data.status
      }
    };

    console.log('✓ Success response prepared:', JSON.stringify(successResponse, null, 2));
    console.log('=== DELIVERY CREATION COMPLETED SUCCESSFULLY ===');

    return NextResponse.json(successResponse);

  } catch (error) {
    console.error('=== DELIVERY CREATION FAILED ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error caught in main try-catch:', error);
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
    
    // Additional debugging information
    if (error instanceof Error) {
      console.error('Error properties:');
      Object.keys(error).forEach(key => {
        console.error(`- ${key}:`, (error as any)[key]);
      });
    }

    // Check if it's a specific type of error
    if (error instanceof TypeError) {
      console.error('⚠️  This is a TypeError - likely missing property or method');
    } else if (error instanceof ReferenceError) {
      console.error('⚠️  This is a ReferenceError - likely undefined variable');
    } else if (error instanceof SyntaxError) {
      console.error('⚠️  This is a SyntaxError - likely JSON parsing issue');
    }

    // Provide more detailed error information based on context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Check if error contains specific Lalamove error patterns
    let errorContext = 'GeneralError';
    if (errorMessage.includes('fetch')) {
      errorContext = 'NetworkError';
      console.error('🌐 Network-related error detected');
    } else if (errorMessage.includes('JSON')) {
      errorContext = 'JSONError';
      console.error('📝 JSON-related error detected');
    } else if (errorMessage.includes('Lalamove')) {
      errorContext = 'LalamoveAPIError';
      console.error('🚚 Lalamove API-related error detected');
    } else if (errorMessage.includes('undefined') || errorMessage.includes('null')) {
      errorContext = 'DataError';
      console.error('🔍 Data/null reference error detected');
    }

    console.error('=== END ERROR DETAILS ===');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create delivery',
        details: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        errorContext: errorContext,
        timestamp: new Date().toISOString(),
        // Include stack trace in development
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Mock response for testing
    return NextResponse.json({
      success: true,
      data: {
        id: orderId,
        message: 'Delivery status endpoint working - Supabase integration disabled for testing'
      }
    });

  } catch (error) {
    console.error('Get delivery status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get delivery status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}