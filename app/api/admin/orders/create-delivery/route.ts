// app/api/admin/orders/create-delivery/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import crypto from 'crypto';

// Lalamove service integration
class LalamoveService {
  private apiKey: string;
  private apiSecret: string;
  private market: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_LALAMOVE_API_KEY!;
    this.apiSecret = process.env.LALAMOVE_API_SECRET!;
    this.market = process.env.LALAMOVE_MARKET!;
    this.baseUrl = process.env.LALAMOVE_BASE_URL!;

    // Validate environment variables
    if (!this.apiKey || !this.apiSecret || !this.market || !this.baseUrl) {
      throw new Error('Missing required Lalamove environment variables');
    }
  }

  private generateSignature(timestamp: string, method: string, path: string, body: string = ''): string {
    const rawSignature = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`;
    console.log('Raw signature string:', JSON.stringify(rawSignature));
    console.log('Raw signature bytes:', rawSignature.length);
    const signature = crypto.createHmac('sha256', this.apiSecret).update(rawSignature, 'utf8').digest('hex');
    console.log('Generated signature:', signature);
    return signature;
  }

  private generateHeaders(method: string, path: string, body?: any): Record<string, string> {
    const timestamp = Date.now().toString();
    
    // For POST requests, we need to stringify the body exactly as it will be sent
    let bodyString = '';
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      // Stringify without extra spaces to match exactly what fetch will send
      bodyString = JSON.stringify(body);
    }
    
    console.log('Headers generation:');
    console.log('- Method:', method);
    console.log('- Path:', path);
    console.log('- Body length:', bodyString.length);
    console.log('- Body preview:', bodyString.substring(0, 100) + '...');
    
    const signature = this.generateSignature(timestamp, method, path, bodyString);
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `hmac ${this.apiKey}:${timestamp}:${signature}`,
      'Market': this.market,
      'Request-ID': crypto.randomUUID(),
    };
    
    console.log('Generated headers (auth redacted):', {
      ...headers,
      'Authorization': `hmac ${this.apiKey.substring(0, 10)}...:${timestamp}:${signature.substring(0, 10)}...`
    });
    
    return headers;
  }

  private async makeRequest<T>(method: string, path: string, body?: any): Promise<any> {
    const headers = this.generateHeaders(method, path, body);
    const url = `${this.baseUrl}${path}`;
    
    console.log('Making Lalamove request:', {
      method,
      url,
      headers: {
        ...headers,
        'Authorization': 'hmac [REDACTED]' // Don't log full auth header
      }
    });

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseText = await response.text();
      console.log('Lalamove response:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      if (!response.ok) {
        throw new Error(`Lalamove API Error: ${response.status} - ${responseData.message || responseText}`);
      }

      return responseData;
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      throw fetchError;
    }
  }

  async getQuotation(quotationData: any) {
    return await this.makeRequest('POST', '/v3/quotations', { data: quotationData });
  }

  async placeOrder(orderData: any) {
    return await this.makeRequest('POST', '/v3/orders', { data: orderData });
  }
}

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

    // Step 3: Validate required fields
    console.log('Step 3: Validating required fields...');
    if (!orderId || !pickupAddress || !deliveryAddress || !senderInfo || !recipientInfo) {
      console.error('✗ Missing required fields');
      console.error('- orderId exists:', !!orderId);
      console.error('- pickupAddress exists:', !!pickupAddress);
      console.error('- deliveryAddress exists:', !!deliveryAddress);
      console.error('- senderInfo exists:', !!senderInfo);
      console.error('- recipientInfo exists:', !!recipientInfo);
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: orderId, pickupAddress, deliveryAddress, senderInfo, recipientInfo' 
        },
        { status: 400 }
      );
    }
    console.log('✓ Required fields validation passed');

    // Step 4: Validate coordinates
    console.log('Step 4: Validating coordinates...');
    if (!pickupAddress.lat || !pickupAddress.lng || !deliveryAddress.lat || !deliveryAddress.lng) {
      console.error('✗ Missing coordinates');
      console.error('- pickup lat/lng:', pickupAddress.lat, pickupAddress.lng);
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
    if (!senderInfo.phone?.startsWith('+') || !recipientInfo.phone?.startsWith('+')) {
      console.error('✗ Invalid phone number format');
      console.error('- sender phone:', senderInfo.phone);
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
      language: 'en_PH', // Adjust based on your market
      stops: [
        {
          coordinates: {
            lat: pickupAddress.lat.toString(),
            lng: pickupAddress.lng.toString()
          },
          address: pickupAddress.address
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
        name: senderInfo.name,
        phone: senderInfo.phone
      },
      recipients: [
        {
          stopId: stops[1].stopId,
          name: recipientInfo.name,
          phone: recipientInfo.phone,
          remarks: notes || `Order #${orderId}`
        }
      ],
      isPODEnabled: true,
      partner: "Your Business Name", // Replace with your business name
      metadata: {
        orderId: orderId,
        customerEmail: "test@gmail.com",
        orderAmount: 100
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

    console.log('Step 11: Preparing success response...');
    const successResponse = {
      success: true,
      data: {
        lalamoveOrderId: lalamoveOrder.data.orderId,
        quotationId: quotationId,
        shareLink: lalamoveOrder.data.shareLink,
        deliveryAmount: lalamoveOrder.data.priceBreakdown?.total || 'N/A',
        currency: lalamoveOrder.data.priceBreakdown?.currency || 'PHP',
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