// app/api/admin/purchase-orders/route.ts
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAuditAction } from "@/lib/audit-logger";

function buildSmsMessage(supplierName: string, poNumber: string, items: { productName: string; size: string; quantity: number }[]): string {
  const itemLines = items.map(i => `- ${i.productName} (${i.size}): ${i.quantity} units`).join("\n");
  return `Hello ${supplierName}, this is SCENTOPIA. Purchase Order #${poNumber}:\n${itemLines}\nPlease confirm availability. You may reply to this number or contact us at 09763866051. Thank you.`;
}

async function generatePoNumber(supabase: ReturnType<typeof createAdminClient>): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const prefix = `PO-${dateStr}-`;

  const { count } = await supabase
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .like("po_number", `${prefix}%`);

  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("purchase_orders")
      .select(
        `id, po_number, status, scheduled_at, sent_at, received_at, notes, created_at,
         suppliers!purchase_orders_supplier_id_fkey(id, name, phone)`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw error;

    // Fetch item counts for all POs in one query
    const poIds = (data ?? []).map((po: any) => po.id);
    const { data: itemCounts } = poIds.length > 0
      ? await supabase.from("purchase_order_items").select("po_id").in("po_id", poIds)
      : { data: [] };

    const countMap: Record<string, number> = {};
    for (const row of (itemCounts ?? [])) {
      countMap[(row as any).po_id] = (countMap[(row as any).po_id] ?? 0) + 1;
    }

    const formatted = (data ?? []).map((po: any) => ({
      id: po.id,
      poNumber: po.po_number,
      status: po.status,
      scheduledAt: po.scheduled_at,
      sentAt: po.sent_at,
      receivedAt: po.received_at,
      notes: po.notes,
      createdAt: po.created_at,
      supplier: po.suppliers,
      itemCount: countMap[po.id] ?? 0,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      totalCount: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
      page,
    });
  } catch (error) {
    console.error("Purchase orders GET error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch purchase orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const supabase = createAdminClient();

  try {
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { supplierId, items, sendNow, scheduledAt, notes } = body;

    // Validation
    if (!supplierId) {
      return NextResponse.json({ success: false, error: "supplierId is required" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "At least one item is required" }, { status: 400 });
    }
    for (const item of items) {
      if (!item.productId || !item.size || !item.productName) {
        return NextResponse.json({ success: false, error: "Each item requires productId, size, and productName" }, { status: 400 });
      }
      const qty = parseInt(item.quantity);
      if (!qty || qty < 1) {
        return NextResponse.json({ success: false, error: `Invalid quantity for ${item.productName} (${item.size})` }, { status: 400 });
      }
    }

    // Fetch supplier
    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .select("id, name, phone")
      .eq("id", supplierId)
      .eq("is_active", true)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json({ success: false, error: "Supplier not found" }, { status: 404 });
    }

    const poNumber = await generatePoNumber(supabase);

    // Determine initial status
    let status = "draft";
    if (sendNow) status = "draft"; // will update after SMS
    else if (scheduledAt) status = "scheduled";

    // Insert purchase order
    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .insert({
        po_number: poNumber,
        supplier_id: supplierId,
        status,
        scheduled_at: scheduledAt || null,
        notes: notes?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (poError) throw poError;

    // Insert items
    const itemRows = items.map((item: any) => ({
      po_id: po.id,
      product_id: item.productId,
      size: item.size,
      quantity: parseInt(item.quantity),
    }));

    const { error: itemsError } = await supabase.from("purchase_order_items").insert(itemRows);
    if (itemsError) throw itemsError;

    // Send SMS immediately if requested
    if (sendNow) {
      const smsMessage = buildSmsMessage(supplier.name, poNumber, items.map((i: any) => ({
        productName: i.productName,
        size: i.size,
        quantity: parseInt(i.quantity),
      })));

      const { error: smsError } = await supabase.functions.invoke("send-purchase-order-sms", {
        body: {
          supplier_name: supplier.name,
          supplier_phone: supplier.phone,
          po_number: poNumber,
          message: smsMessage,
        },
      });

      const newStatus = smsError ? "failed" : "sent";
      await supabase
        .from("purchase_orders")
        .update({
          status: newStatus,
          sent_at: smsError ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", po.id);

      po.status = newStatus;
    }

    await logAuditAction({
      action: "CREATE",
      module: "INVENTORY",
      entityId: po.id,
      entityLabel: poNumber,
      metadata: { supplier: supplier.name, item_count: items.length },
    }, request);

    return NextResponse.json({ success: true, data: { ...po, poNumber } }, { status: 201 });
  } catch (error) {
    console.error("Purchase orders POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create purchase order", details: error instanceof Error ? error.message : JSON.stringify(error) },
      { status: 500 }
    );
  }
}
