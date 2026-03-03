// app/api/admin/reports/fast-moving/route.ts
//
// Classification rule (simple, explainable to staff):
//   Very Fast  = sold ≥ (days)      units in period  → e.g. ≥30 in 30 days
//   Fast       = sold ≥ (days ÷ 3)  units in period  → e.g. ≥10 in 30 days
//
// The thresholds are returned in the response so the UI can display the rule
// transparently without staff needing to know what "velocity" means.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_STATUSES = ["Delivered", "Confirmed", "Processing", "Pending", "Shipped"];

/** Thresholds scale with the chosen period so the rule stays consistent. */
function getThresholds(days: number) {
  return {
    fast:     Math.ceil(days / 3), // e.g. 10 for 30d | 5 for 14d | 3 for 7d
    veryFast: days,                // e.g. 30 for 30d | 14 for 14d | 7 for 7d
  };
}

function getRestockStatus(stock: number): "out" | "critical" | "low" | "ok" {
  if (stock === 0)  return "out";
  if (stock <= 5)   return "critical";
  if (stock <= 20)  return "low";
  return "ok";
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const days = Math.min(365, Math.max(1,
      parseInt(request.nextUrl.searchParams.get("days") || "30")
    ));
    const thresholds = getThresholds(days);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // ── Fetch active products ───────────────────────────────────────────────
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, stocks, images")
      .eq("is_active", true);

    if (productsError) throw productsError;

    if (!products?.length) {
      return NextResponse.json({
        success: true,
        data: {
          products: [],
          summary: { fastCount: 0, veryFastCount: 0, totalUnitsSold: 0, totalRevenue: 0, needsRestockCount: 0 },
          thresholds,
          days,
        },
      });
    }

    // ── Fetch order items in the period ────────────────────────────────────
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_id, quantity, item_amount, orders(id, order_status)")
      .gte("created_at", startDate.toISOString());

    // ── Aggregate sales per product ────────────────────────────────────────
    type SalesEntry = { units: number; revenue: number; orderIds: Set<string> };
    const salesMap: Record<string, SalesEntry> = {};

    for (const item of orderItems ?? []) {
      const order = (item as any).orders;
      if (!VALID_STATUSES.includes(order?.order_status)) continue;
      const pid = item.product_id;
      if (!salesMap[pid]) salesMap[pid] = { units: 0, revenue: 0, orderIds: new Set() };
      salesMap[pid].units    += item.quantity ?? 0;
      salesMap[pid].revenue  += (item as any).item_amount ?? 0;
      if (order?.id) salesMap[pid].orderIds.add(order.id);
    }

    // ── Build result ───────────────────────────────────────────────────────
    const result = products
      .map((p) => {
        const sales      = salesMap[p.id] ?? { units: 0, revenue: 0, orderIds: new Set<string>() };
        const totalStock = Object.values((p.stocks as Record<string, number>) ?? {})
          .reduce((s, q) => s + (q ?? 0), 0);

        const restockStatus = getRestockStatus(totalStock);
        const avgDailySales = parseFloat((sales.units / days).toFixed(2));
        const daysRemaining = avgDailySales > 0 ? Math.floor(totalStock / avgDailySales) : null;

        let classification: "very_fast" | "fast" | null = null;
        if (sales.units >= thresholds.veryFast) classification = "very_fast";
        else if (sales.units >= thresholds.fast)  classification = "fast";

        return {
          productId:    p.id,
          productName:  p.name ?? "Unknown",
          productPrice: p.price ?? 0,
          productImage: Array.isArray(p.images) ? (p.images[0] ?? null) : null,
          unitsSold:    sales.units,
          totalRevenue: sales.revenue,
          orderCount:   sales.orderIds.size,
          currentStock: totalStock,
          restockStatus,
          avgDailySales,
          daysRemaining,
          classification,
        };
      })
      .filter((p) => p.classification !== null)
      .sort((a, b) => b.unitsSold - a.unitsSold);

    const summary = {
      fastCount:        result.filter((p) => p.classification === "fast").length,
      veryFastCount:    result.filter((p) => p.classification === "very_fast").length,
      totalUnitsSold:   result.reduce((s, p) => s + p.unitsSold, 0),
      totalRevenue:     result.reduce((s, p) => s + p.totalRevenue, 0),
      needsRestockCount: result.filter((p) => p.restockStatus !== "ok").length,
    };

    return NextResponse.json({
      success: true,
      data: { products: result, summary, thresholds, days },
    });

  } catch (error) {
    console.error("[FastMoving]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch fast-moving items" },
      { status: 500 }
    );
  }
}
