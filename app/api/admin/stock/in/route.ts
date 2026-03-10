import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logStockIn } from "@/lib/audit-logger";

export async function POST(request: NextRequest) {
  const authClient = await createClient();

  try {
    const supabase = createAdminClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { productId, size, quantity, reason, remarks } = body;

    if (!productId || !size) {
      return NextResponse.json(
        { success: false, error: "productId and size are required" },
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
    const newStock = previousStock + qty;

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
        type: "IN",
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

    logStockIn(productId, product.name ?? productId, size, qty, previousStock, request);

    return NextResponse.json({
      success: true,
      previousStock,
      newStock,
      movement,
    });
  } catch (error) {
    console.error("Stock in error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process stock in",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
