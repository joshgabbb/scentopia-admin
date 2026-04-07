import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const productId = searchParams.get("productId") || "";
    const typeFilter = searchParams.get("type") || "all"; // all | IN | OUT | PURCHASE
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const limitParam = parseInt(searchParams.get("limit") || "25");
    const limit = [25, 50, 100].includes(limitParam) ? limitParam : 25;

    const dateFromISO = dateFrom ? new Date(dateFrom).toISOString() : null;
    const dateToISO = dateTo
      ? (() => { const d = new Date(dateTo); d.setDate(d.getDate() + 1); return d.toISOString(); })()
      : null;

    // ── 1. Stock movements (admin IN / OUT) ─────────────────────────────────
    let stockMovements: any[] = [];

    if (typeFilter === "all" || typeFilter === "IN" || typeFilter === "OUT") {
      let q = supabase
        .from("stock_movements")
        .select(`id, product_id, size, type, quantity, previous_stock, new_stock, reason, remarks, created_by, created_at, products!inner(name, images)`)
        .order("created_at", { ascending: false });

      if (productId) q = q.eq("product_id", productId);
      if (typeFilter === "IN" || typeFilter === "OUT") q = q.eq("type", typeFilter);
      if (dateFromISO) q = q.gte("created_at", dateFromISO);
      if (dateToISO) q = q.lt("created_at", dateToISO);

      const { data } = await q;
      stockMovements = data || [];
    }

    // Resolve admin names
    const creatorIds = [...new Set(stockMovements.filter(m => m.created_by).map(m => m.created_by as string))];
    let profilesMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", creatorIds);
      if (profiles) {
        profilesMap = Object.fromEntries(
          profiles.map(p => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || "Admin"])
        );
      }
    }

    const formattedStock = stockMovements.map(m => {
      const product = Array.isArray(m.products) ? m.products[0] : m.products;
      return {
        id: m.id,
        source: "stock" as const,
        productId: m.product_id,
        productName: product?.name || "Unknown Product",
        productImage: product?.images?.[0] || null,
        size: m.size,
        type: m.type as "IN" | "OUT",
        quantity: m.quantity,
        previousStock: m.previous_stock ?? 0,
        newStock: m.new_stock ?? 0,
        reason: m.reason,
        remarks: m.remarks,
        createdBy: m.created_by,
        createdByName: m.created_by ? (profilesMap[m.created_by] || "Admin") : null,
        createdAt: m.created_at,
        orderId: null,
        customerName: null,
      };
    });

    // ── 2. Customer purchases from order_items ───────────────────────────────
    let formattedPurchases: any[] = [];

    if (typeFilter === "all" || typeFilter === "PURCHASE") {
      let pq = supabase
        .from("order_items")
        .select(`
          id,
          product_id,
          quantity,
          size,
          item_amount,
          orders!inner(id, created_at, order_status, user_id),
          products!inner(name, images)
        `)
        .not("orders.order_status", "eq", "Cancelled")
        .order("orders(created_at)", { ascending: false });

      if (productId) pq = pq.eq("product_id", productId);
      if (dateFromISO) pq = pq.gte("orders.created_at", dateFromISO);
      if (dateToISO) pq = pq.lt("orders.created_at", dateToISO);

      const { data: purchaseData } = await pq;
      const purchases = purchaseData || [];

      // Resolve customer names
      const customerIds = [...new Set(purchases.map((p: any) => {
        const order = Array.isArray(p.orders) ? p.orders[0] : p.orders;
        return order?.user_id as string;
      }).filter(Boolean))];

      let customerMap: Record<string, string> = {};
      if (customerIds.length > 0) {
        const { data: customerProfiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", customerIds);
        if (customerProfiles) {
          customerMap = Object.fromEntries(
            customerProfiles.map((p: any) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || "Customer"])
          );
        }
      }

      formattedPurchases = purchases.map((p: any) => {
        const product = Array.isArray(p.products) ? p.products[0] : p.products;
        const order = Array.isArray(p.orders) ? p.orders[0] : p.orders;
        const customerName = order?.user_id ? (customerMap[order.user_id] || "Customer") : "Customer";
        return {
          id: `purchase-${p.id}`,
          source: "purchase" as const,
          productId: p.product_id,
          productName: product?.name || "Unknown Product",
          productImage: product?.images?.[0] || null,
          size: p.size,
          type: "PURCHASE" as const,
          quantity: p.quantity,
          previousStock: null,
          newStock: null,
          reason: `Order #${String(order?.id || "").slice(0, 8).toUpperCase()}`,
          remarks: null,
          createdBy: order?.user_id || null,
          createdByName: customerName,
          createdAt: order?.created_at || new Date().toISOString(),
          orderId: order?.id || null,
          customerName,
        };
      });
    }

    // ── 3. Merge, sort, paginate ─────────────────────────────────────────────
    const all = [...formattedStock, ...formattedPurchases].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const totalCount = all.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const offset = (page - 1) * limit;
    const paged = all.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: {
        movements: paged,
        totalCount,
        totalPages,
        currentPage: page,
      },
    });
  } catch (error) {
    console.error("Stock history error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stock history", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
