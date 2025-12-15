import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  
  try {
    const { id: orderId } = await context.params;
    const { status, title, body } = await request.json();
    
    // Update order status
    const { error: orderError } = await supabase
      .from('orders')
      .update({ 
        order_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (orderError) throw orderError;

    // Add tracking entry
    const { error: trackingError } = await supabase
      .from('order_tracking')
      .insert({
        order_id: orderId,
        order_status: status,
        title: title || `Order ${status}`,
        body: body || `Your order has been ${status.toLowerCase()}`,
      });

    if (trackingError) throw trackingError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Status update error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update order status'
      },
      { status: 500 }
    );
  }
}
