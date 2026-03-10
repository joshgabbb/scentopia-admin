import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logStockOut, logAuditAction } from "@/lib/audit-logger";

interface CartItem {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

function generateTransactionNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `POS-${y}${m}${d}-${rand}`;
}

export async function POST(request: NextRequest) {
  const authClient = await createClient();

  try {
    const supabase = createAdminClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { items, paymentMethod, cashReceived, notes } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "Cart is empty" }, { status: 400 });
    }
    if (!paymentMethod) {
      return NextResponse.json({ success: false, error: "Payment method is required" }, { status: 400 });
    }

    // ── Phase 1: Validate all items before making any changes ──────────────
    type StockDeduction = {
      productId: string;
      productName: string;
      size: string;
      quantity: number;
      previousStock: number;
      newStock: number;
      updatedStocks: Record<string, number>;
    };

    const stockDeductions: StockDeduction[] = [];

    for (const item of items as CartItem[]) {
      const { productId, productName, size, quantity } = item;

      if (!productId || !size || !quantity || quantity <= 0) {
        return NextResponse.json(
          { success: false, error: `Invalid item data: ${productName || "unknown"}` },
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
          { success: false, error: `Product not found: ${productName}` },
          { status: 404 }
        );
      }

      const currentStocks = (product.stocks as Record<string, number>) || {};
      const previousStock = currentStocks[size] ?? 0;

      if (previousStock < quantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient stock for ${productName} (${size}). Available: ${previousStock}, Requested: ${quantity}`,
          },
          { status: 400 }
        );
      }

      const newStock = previousStock - quantity;
      stockDeductions.push({
        productId,
        productName,
        size,
        quantity,
        previousStock,
        newStock,
        updatedStocks: { ...currentStocks, [size]: newStock },
      });
    }

    // ── Phase 2: Commit all changes ─────────────────────────────────────────
    const totalAmount = (items as CartItem[]).reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    const cashReceivedNum = paymentMethod === "cash" ? (parseFloat(cashReceived) || 0) : totalAmount;
    const changeAmount = Math.max(0, cashReceivedNum - totalAmount);

    // 2a. Update stock & record stock_movements for each item
    for (const d of stockDeductions) {
      const { error: updateError } = await supabase
        .from("products")
        .update({ stocks: d.updatedStocks, updated_at: new Date().toISOString() })
        .eq("id", d.productId);

      if (updateError) throw updateError;

      const { error: movementError } = await supabase.from("stock_movements").insert({
        product_id: d.productId,
        size: d.size,
        type: "OUT",
        quantity: d.quantity,
        previous_stock: d.previousStock,
        new_stock: d.newStock,
        reason: "Sale",
        remarks: "POS – Physical Store Transaction",
        created_by: user.id,
      });

      if (movementError) throw movementError;

      // Fire-and-forget audit log per item
      logStockOut(d.productId, d.productName, d.size, d.quantity, d.previousStock, request);
    }

    // 2b. Create pos_transaction record
    const transactionNumber = generateTransactionNumber();

    const { data: transaction, error: txError } = await supabase
      .from("pos_transactions")
      .insert({
        transaction_number: transactionNumber,
        total_amount: totalAmount,
        cash_received: cashReceivedNum,
        change_amount: changeAmount,
        payment_method: paymentMethod,
        sale_source: "physical_store",
        notes: notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (txError) throw txError;

    // 2c. Insert transaction items
    const txItems = (items as CartItem[]).map((item) => ({
      transaction_id: transaction.id,
      product_id: item.productId,
      product_name: item.productName,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      subtotal: item.unitPrice * item.quantity,
    }));

    const { error: itemsError } = await supabase.from("pos_transaction_items").insert(txItems);
    if (itemsError) throw itemsError;

    // 2d. Audit log for the overall POS sale
    logAuditAction(
      {
        action: "CREATE",
        module: "ORDER",
        entityId: transaction.id,
        entityLabel: transactionNumber,
        newValue: {
          transaction_number: transactionNumber,
          total_amount: totalAmount,
          item_count: items.length,
          sale_source: "physical_store",
          payment_method: paymentMethod,
        },
        metadata: { sale_source: "physical_store" },
      },
      request
    );

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        transactionNumber,
        totalAmount,
        cashReceived: cashReceivedNum,
        changeAmount,
        paymentMethod,
        createdAt: transaction.created_at,
      },
    });
  } catch (error) {
    console.error("POS checkout error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process transaction",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
