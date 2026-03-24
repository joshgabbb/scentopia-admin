// app/api/admin/purchase-orders/[id]/receive/route.ts
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAuditAction } from "@/lib/audit-logger";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const authClient = await createClient();
  const supabase = createAdminClient();

  try {
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Fetch PO and items separately
    const [{ data: po, error: poError }, { data: items, error: itemsError }] = await Promise.all([
      supabase.from("purchase_orders").select("id, po_number, status").eq("id", id).single(),
      supabase.from("purchase_order_items").select("product_id, size, quantity, products(id, name, stocks)").eq("po_id", id),
    ]);

    if (poError || !po) {
      return NextResponse.json({ success: false, error: "Purchase order not found" }, { status: 404 });
    }

    if ((po as any).status !== "sent") {
      return NextResponse.json(
        { success: false, error: "Only sent purchase orders can be marked as received" },
        { status: 400 }
      );
    }

    // Process each item: update stock + insert movement
    for (const item of (items ?? [])) {
      const product = item.products;
      if (!product) continue;

      const currentStocks = (product.stocks || {}) as Record<string, number>;
      const previousStock = currentStocks[item.size] ?? 0;
      const newStock = previousStock + item.quantity;
      const updatedStocks = { ...currentStocks, [item.size]: newStock };

      // Update product stocks
      const { error: updateError } = await supabase
        .from("products")
        .update({ stocks: updatedStocks, updated_at: new Date().toISOString() })
        .eq("id", item.product_id);

      if (updateError) throw updateError;

      // Insert stock movement
      const { error: movementError } = await supabase.from("stock_movements").insert({
        product_id: item.product_id,
        size: item.size,
        type: "IN",
        quantity: item.quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        reason: "Purchase Order",
        remarks: `PO# ${(po as any).po_number}`,
        created_by: user.id,
      });

      if (movementError) throw movementError;
    }

    // Mark PO as received
    await supabase
      .from("purchase_orders")
      .update({ status: "received", received_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id);

    await logAuditAction({
      action: "UPDATE",
      module: "INVENTORY",
      entityId: id,
      entityLabel: (po as any).po_number,
      metadata: { action: "received", items_count: (items ?? []).length },
    }, request);

    return NextResponse.json({
      success: true,
      message: `PO ${(po as any).po_number} marked as received. ${(items ?? []).length} stock movement(s) created.`,
    });
  } catch (error) {
    console.error("PO receive error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process received order", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
