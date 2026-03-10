// app/api/admin/reports/slow-moving/route.ts
//
// Classification rule (simple, explainable to staff):
//   No Sales   = sold 0 units in period
//   Very Slow  = sold 1 – (days÷6) units      e.g. 1–5 in 30 days
//   Slow       = sold (days÷6)+1 – (days÷3)-1 e.g. 6–9 in 30 days
//   Moderate   = sold (days÷3) – (days-1)     e.g. 10–29 in 30 days
//   (Fast Moving ≥ days÷3 → not shown here)
//
// Thresholds are returned so the UI can display the rule transparently.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_STATUSES = ["Delivered", "Confirmed", "Processing", "Pending", "Shipped"];

function getThresholds(days: number) {
  return {
    verySlowMax: Math.ceil(days / 6),       // e.g. 5 for 30d
    slowMax:     Math.ceil(days / 3) - 1,   // e.g. 9 for 30d
    fastMin:     Math.ceil(days / 3),        // e.g. 10 for 30d (excluded)
  };
}

function getRecommendation(status: string): string {
  switch (status) {
    case "no_sales":  return "Review product viability — consider promotions or discontinuing";
    case "very_slow": return "Run a promotion or reduce future purchase orders";
    case "slow":      return "Consider a discount or bundling with a faster product";
    case "moderate":  return "Monitor sales trend — no action needed yet";
    default:          return "Continue monitoring";
  }
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
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, price, stocks, images, created_at")
      .eq("is_active", true);

    if (error) throw error;

    if (!products?.length) {
      return NextResponse.json({
        success: true,
        data: {
          products: [],
          summary: { noSalesCount: 0, verySlowCount: 0, slowCount: 0, moderateCount: 0, totalStockValue: 0 },
          thresholds,
          days,
        },
      });
    }

    // ── Fetch order items in the period ────────────────────────────────────
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_id, quantity, orders(order_status)")
      .gte("created_at", startDate.toISOString());

    // ── Aggregate sales per product ────────────────────────────────────────
    const salesMap: Record<string, number> = {};
    for (const item of orderItems ?? []) {
      if (!VALID_STATUSES.includes((item as any).orders?.order_status)) continue;
      salesMap[item.product_id] = (salesMap[item.product_id] ?? 0) + (item.quantity ?? 0);
    }

    // ── Build result ───────────────────────────────────────────────────────
    const result = products
      .map((p) => {
        const unitsSold  = salesMap[p.id] ?? 0;
        const totalStock = Object.values((p.stocks as Record<string, number>) ?? {})
          .reduce((s, q) => s + (q ?? 0), 0);

        const productAgeDays = Math.floor(
          (Date.now() - new Date(p.created_at).getTime()) / 86_400_000
        );

        let status: "no_sales" | "very_slow" | "slow" | "moderate";
        if      (unitsSold === 0)                          status = "no_sales";
        else if (unitsSold <= thresholds.verySlowMax)      status = "very_slow";
        else if (unitsSold <= thresholds.slowMax)          status = "slow";
        else                                               status = "moderate";

        return {
          productId:      p.id,
          productName:    p.name ?? "Unknown",
          productPrice:   p.price ?? 0,
          productImage:   Array.isArray(p.images) ? (p.images[0] ?? null) : null,
          unitsSold,
          currentStock:   totalStock,
          stockValue:     totalStock * (p.price ?? 0),
          productAgeDays,
          status,
          recommendation: getRecommendation(status),
        };
      })
      // Exclude fast-moving products (they belong in the other report)
      .filter((p) => p.unitsSold < thresholds.fastMin)
      .sort((a, b) => a.unitsSold - b.unitsSold);

    const summary = {
      noSalesCount:    result.filter((p) => p.status === "no_sales").length,
      verySlowCount:   result.filter((p) => p.status === "very_slow").length,
      slowCount:       result.filter((p) => p.status === "slow").length,
      moderateCount:   result.filter((p) => p.status === "moderate").length,
      totalStockValue: result.reduce((s, p) => s + p.stockValue, 0),
    };

    return NextResponse.json({
      success: true,
      data: { products: result, summary, thresholds, days },
    });

  } catch (error) {
    console.error("[SlowMoving]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch slow-moving items" },
      { status: 500 }
    );
  }
}
