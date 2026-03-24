// app/api/admin/purchase-orders/scheduled/route.ts
// Processes due scheduled purchase orders — called by frontend polling every 30s
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = createAdminClient();

  try {
    // Fetch scheduled POs that are due and not yet sent (optimistic lock via sent_at IS NULL)
    const { data: duePOs, error } = await supabase
      .from("purchase_orders")
      .select(
        `id, po_number, supplier_id, sent_at,
         suppliers!purchase_orders_supplier_id_fkey(name, phone),
         purchase_order_items!purchase_order_items_po_id_fkey(
           size, quantity,
           products!purchase_order_items_product_id_fkey(name)
         )`
      )
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .is("sent_at", null);

    if (error) throw error;
    if (!duePOs || duePOs.length === 0) {
      return NextResponse.json({ success: true, processed: 0, failed: 0 });
    }

    let processed = 0;
    let failed = 0;

    for (const po of duePOs) {
      const supplier = (po as any).suppliers;
      if (!supplier) { failed++; continue; }

      const items = ((po as any).purchase_order_items as any[]).map((i: any) => ({
        productName: i.products?.name || "Unknown",
        size: i.size,
        quantity: i.quantity,
      }));

      const itemLines = items.map(i => `- ${i.productName} (${i.size}): ${i.quantity} units`).join("\n");
      const message = `Hello ${supplier.name}, this is SCENTOPIA. Purchase Order #${(po as any).po_number}:\n${itemLines}\nPlease confirm availability. You may reply to this number or contact us at 09763866051. Thank you.`;

      const { error: smsError } = await supabase.functions.invoke("send-purchase-order-sms", {
        body: {
          supplier_name: supplier.name,
          supplier_phone: supplier.phone,
          po_number: (po as any).po_number,
          message,
        },
      });

      if (smsError) {
        await supabase.from("purchase_orders").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", (po as any).id);
        failed++;
      } else {
        await supabase.from("purchase_orders").update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", (po as any).id);
        processed++;
      }
    }

    return NextResponse.json({ success: true, processed, failed });
  } catch (error) {
    console.error("Scheduled PO processor error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process scheduled purchase orders" },
      { status: 500 }
    );
  }
}
