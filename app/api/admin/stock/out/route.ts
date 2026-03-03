import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logStockOut } from "@/lib/audit-logger";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { productId, size, quantity, reason, remarks } = body;

    if (!productId || !size || !reason) {
      return NextResponse.json(
        { success: false, error: "productId, size, and reason are required" },
        { status: 400 }
      );
    }

    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      return NextResponse.json(
        { success: false, error: "quantity must be a positive integer" },
        { status: 400 }
      );
    }

    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("name, stocks")
      .eq("id", productId)
      .single();

    if (fetchError || !product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    const currentStocks = (product.stocks as Record<string, number>) || {};
    const previousStock = currentStocks[size] ?? 0;

    if (previousStock < qty) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient stock. Available: ${previousStock}, Requested: ${qty}`,
        },
        { status: 400 }
      );
    }

    const newStock = previousStock - qty;
    const updatedStocks = { ...currentStocks, [size]: newStock };

    const { error: updateError } = await supabase
      .from("products")
      .update({ stocks: updatedStocks, updated_at: new Date().toISOString() })
      .eq("id", productId);

    if (updateError) throw updateError;

    const { data: movement, error: movementError } = await supabase
      .from("stock_movements")
      .insert({
        product_id: productId,
        size,
        type: "OUT",
        quantity: qty,
        previous_stock: previousStock,
        new_stock: newStock,
        reason: reason || null,
        remarks: remarks || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (movementError) throw movementError;

    logStockOut(productId, product.name ?? productId, size, qty, previousStock, request);

    return NextResponse.json({
      success: true,
      previousStock,
      newStock,
      movement,
    });
  } catch (error) {
    console.error("Stock out error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process stock out",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
