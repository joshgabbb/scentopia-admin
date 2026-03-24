// app/api/admin/purchase-orders/[id]/route.ts
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = createAdminClient();

  try {
    const [{ data: po, error }, { data: rawItems, error: itemsError }] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select(`id, po_number, status, scheduled_at, sent_at, received_at, notes, created_at, supplier_id,
                 suppliers!purchase_orders_supplier_id_fkey(id, name, phone, email)`)
        .eq("id", id)
        .single(),
      supabase
        .from("purchase_order_items")
        .select(`id, size, quantity, product_id, products(id, name, stocks)`)
        .eq("po_id", id),
    ]);

    if (error || !po) {
      return NextResponse.json({ success: false, error: "Purchase order not found" }, { status: 404 });
    }

    const items = (rawItems ?? []).map((item: any) => {
      const stocks = (item.products?.stocks || {}) as Record<string, number>;
      return {
        id: item.id,
        productId: item.products?.id,
        productName: item.products?.name || "Unknown",
        size: item.size,
        quantity: item.quantity,
        currentStock: stocks[item.size] ?? 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        id: (po as any).id,
        poNumber: (po as any).po_number,
        status: (po as any).status,
        scheduledAt: (po as any).scheduled_at,
        sentAt: (po as any).sent_at,
        receivedAt: (po as any).received_at,
        notes: (po as any).notes,
        createdAt: (po as any).created_at,
        supplierId: (po as any).supplier_id,
        supplier: (po as any).suppliers,
        items,
      },
    });
  } catch (error) {
    console.error("PO GET error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch purchase order" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const authClient = await createClient();
  const supabase = createAdminClient();

  try {
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    const [{ data: po, error: fetchError }, { data: poItems }] = await Promise.all([
      supabase.from("purchase_orders").select("id, status, po_number, supplier_id").eq("id", id).single(),
      supabase.from("purchase_order_items").select("product_id, size, quantity, products(name)").eq("po_id", id),
    ]);

    if (fetchError || !po) {
      return NextResponse.json({ success: false, error: "Purchase order not found" }, { status: 404 });
    }

    // Attach items to po object for reuse below
    (po as any).purchase_order_items = poItems ?? [];

    if (action === "send") {
      if ((po as any).status !== "draft") {
        return NextResponse.json({ success: false, error: "Only draft POs can be sent" }, { status: 400 });
      }

      const { data: supplier } = await supabase.from("suppliers").select("name, phone").eq("id", (po as any).supplier_id).single();
      if (!supplier) return NextResponse.json({ success: false, error: "Supplier not found" }, { status: 404 });

      const items = ((po as any).purchase_order_items as any[]).map((i: any) => ({
        productName: i.products?.name || "Unknown",
        size: i.size,
        quantity: i.quantity,
      }));

      const itemLines = items.map(i => `- ${i.productName} (${i.size}): ${i.quantity} units`).join("\n");
      const message = `Hello ${supplier.name}, this is SCENTOPIA. Purchase Order #${(po as any).po_number}:\n${itemLines}\nPlease confirm availability. You may reply to this number or contact us at 09763866051. Thank you.`;

      const { error: smsError } = await supabase.functions.invoke("send-purchase-order-sms", {
        body: { supplier_name: supplier.name, supplier_phone: supplier.phone, po_number: (po as any).po_number, message },
      });

      const newStatus = smsError ? "failed" : "sent";
      await supabase.from("purchase_orders").update({ status: newStatus, sent_at: smsError ? null : new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);

      if (smsError) return NextResponse.json({ success: false, error: "SMS failed to send", details: String(smsError) }, { status: 500 });
      return NextResponse.json({ success: true, data: { status: newStatus } });
    }

    if (action === "cancel") {
      if (!["draft", "scheduled", "failed"].includes((po as any).status)) {
        return NextResponse.json({ success: false, error: "Only draft, scheduled, or failed POs can be cancelled" }, { status: 400 });
      }
      await supabase.from("purchase_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id);
      return NextResponse.json({ success: true, data: { status: "cancelled" } });
    }

    if (action === "retry") {
      if ((po as any).status !== "failed") {
        return NextResponse.json({ success: false, error: "Only failed POs can be retried" }, { status: 400 });
      }

      const { data: supplier } = await supabase.from("suppliers").select("name, phone").eq("id", (po as any).supplier_id).single();
      if (!supplier) return NextResponse.json({ success: false, error: "Supplier not found" }, { status: 404 });

      const items = ((po as any).purchase_order_items as any[]).map((i: any) => ({
        productName: i.products?.name || "Unknown",
        size: i.size,
        quantity: i.quantity,
      }));

      const itemLines = items.map(i => `- ${i.productName} (${i.size}): ${i.quantity} units`).join("\n");
      const message = `Hello ${supplier.name}, this is SCENTOPIA. Purchase Order #${(po as any).po_number}:\n${itemLines}\nPlease confirm availability. You may reply to this number or contact us at 09763866051. Thank you.`;

      const { error: smsError } = await supabase.functions.invoke("send-purchase-order-sms", {
        body: { supplier_name: supplier.name, supplier_phone: supplier.phone, po_number: (po as any).po_number, message },
      });

      const newStatus = smsError ? "failed" : "sent";
      await supabase.from("purchase_orders").update({ status: newStatus, sent_at: smsError ? null : new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
      return NextResponse.json({ success: true, data: { status: newStatus } });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("PO PATCH error:", error);
    return NextResponse.json({ success: false, error: "Failed to update purchase order" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const authClient = await createClient();
  const supabase = createAdminClient();

  try {
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: po } = await supabase.from("purchase_orders").select("status").eq("id", id).single();
    if (!po || !["draft", "cancelled"].includes((po as any).status)) {
      return NextResponse.json({ success: false, error: "Only draft or cancelled POs can be deleted" }, { status: 400 });
    }

    const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PO DELETE error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete purchase order" }, { status: 500 });
  }
}
