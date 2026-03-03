// app/api/admin/reports/inventory-alerts/route.ts
//
// Stock classification thresholds (plain English for staff):
//   Out of Stock   = 0 units
//   Critical Stock = 1–5 units
//   Low Stock      = 6–20 units
//   Fast Moving    = sold ≥10 in last 30 days AND stock ≤50
//   Slow Moving    = 0 sales in last 30 days AND stock >50
//
// GET  → returns current alerts list with summary
// POST → pushes critical/high alerts into admin_notifications (24 h cooldown)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── Thresholds (single source of truth for both GET and POST) ──────────────
const THRESHOLDS = {
  outOfStock:   0,
  critical:     5,   // ≤5 units  → critical
  low:          20,  // ≤20 units → high (low stock)
  moderate:     50,  // ≤50 units → medium
  fastMin30d:   10,  // sold ≥10 in 30 days → fast moving alert
} as const;

const VALID_STATUSES = ["Delivered", "Confirmed", "Processing", "Pending", "Shipped"];

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/admin/reports/inventory-alerts
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase    = await createClient();
    const filterType  = request.nextUrl.searchParams.get("filter") || "all";

    // Fetch all active products
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, stocks, images, price")
      .eq("is_active", true);

    if (error) throw error;

    if (!products?.length) {
      return NextResponse.json({
        success: true,
        data: { alerts: [], summary: buildEmptySummary() },
      });
    }

    // 30-day sales for fast/slow detection
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_id, quantity, orders(order_status)")
      .gte("created_at", thirtyDaysAgo.toISOString());

    const salesMap: Record<string, number> = {};
    for (const item of orderItems ?? []) {
      if (!VALID_STATUSES.includes((item as any).orders?.order_status)) continue;
      salesMap[item.product_id] = (salesMap[item.product_id] ?? 0) + (item.quantity ?? 0);
    }

    // Build alert list — only products that actually need attention
    type AlertSeverity = "critical" | "high" | "medium" | "low";
    type AlertType     = "out_of_stock" | "critical_stock" | "low_stock" | "fast_moving" | "slow_moving";

    const allAlerts = products
      .map((p) => {
        const totalStock = Object.values((p.stocks as Record<string, number>) ?? {})
          .reduce((s, q) => s + (q ?? 0), 0);
        const sold30d       = salesMap[p.id] ?? 0;
        const avgDailySales = parseFloat((sold30d / 30).toFixed(2));
        const daysRemaining = avgDailySales > 0 ? Math.floor(totalStock / avgDailySales) : null;

        let severity: AlertSeverity;
        let type:     AlertType;
        let message:  string;

        if (totalStock === 0) {
          severity = "critical";
          type     = "out_of_stock";
          message  = "Out of stock — requires immediate restocking";
        } else if (totalStock <= THRESHOLDS.critical) {
          severity = "critical";
          type     = "critical_stock";
          message  = `Only ${totalStock} unit${totalStock === 1 ? "" : "s"} remaining — critical level`;
        } else if (totalStock <= THRESHOLDS.low) {
          severity = "high";
          type     = "low_stock";
          message  = `${totalStock} units remaining — below reorder level (${THRESHOLDS.low})`;
        } else if (sold30d >= THRESHOLDS.fastMin30d && totalStock <= THRESHOLDS.moderate) {
          severity = "medium";
          type     = "fast_moving";
          message  = `Sold ${sold30d} units in 30 days with only ${totalStock} units left`;
        } else if (sold30d === 0 && totalStock > THRESHOLDS.moderate) {
          severity = "low";
          type     = "slow_moving";
          message  = `No sales in the last 30 days — ${totalStock} units sitting idle`;
        } else {
          return null; // Healthy product — no alert needed
        }

        return {
          id:           p.id,
          productId:    p.id,
          productName:  p.name,
          productImage: Array.isArray(p.images) ? (p.images[0] ?? null) : null,
          currentStock: totalStock,
          unitsSold30d: sold30d,
          avgDailySales,
          daysRemaining,
          severity,
          type,
          message,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    // Apply filter
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

    let filtered = allAlerts;
    if (filterType === "critical") {
      filtered = allAlerts.filter((a) => a.type === "out_of_stock" || a.type === "critical_stock");
    } else if (filterType === "low_stock") {
      filtered = allAlerts.filter((a) => a.type === "low_stock");
    } else if (filterType === "fast_moving") {
      filtered = allAlerts.filter((a) => a.type === "fast_moving");
    } else if (filterType === "slow_moving") {
      filtered = allAlerts.filter((a) => a.type === "slow_moving");
    }

    filtered.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const summary = {
      total:    allAlerts.length,
      critical: allAlerts.filter((a) => a.severity === "critical").length,
      high:     allAlerts.filter((a) => a.severity === "high").length,
      medium:   allAlerts.filter((a) => a.severity === "medium").length,
      low:      allAlerts.filter((a) => a.severity === "low").length,
      alertTypes: {
        outOfStock:    allAlerts.filter((a) => a.type === "out_of_stock").length,
        criticalStock: allAlerts.filter((a) => a.type === "critical_stock").length,
        lowStock:      allAlerts.filter((a) => a.type === "low_stock").length,
        fastMoving:    allAlerts.filter((a) => a.type === "fast_moving").length,
        slowMoving:    allAlerts.filter((a) => a.type === "slow_moving").length,
      },
      thresholds: THRESHOLDS,
    };

    return NextResponse.json({ success: true, data: { alerts: filtered, summary } });

  } catch (error) {
    console.error("[InventoryAlerts GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch inventory alerts" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/reports/inventory-alerts
// Pushes critical/high alerts into admin_notifications.
// 24-hour cooldown per product prevents duplicate alerts.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Fetch current stock for all active products
    const { data: products } = await supabase
      .from("products")
      .select("id, name, stocks")
      .eq("is_active", true);

    if (!products?.length) {
      return NextResponse.json({ success: true, data: { created: 0, skipped: 0 } });
    }

    // Keep only products that need an alert (≤ low threshold)
    const alertProducts = products.filter((p) => {
      const totalStock = Object.values((p.stocks as Record<string, number>) ?? {})
        .reduce((s, q) => s + (q ?? 0), 0);
      return totalStock <= THRESHOLDS.low;
    });

    if (!alertProducts.length) {
      return NextResponse.json({
        success: true,
        data: { created: 0, skipped: 0, message: "No critical/low-stock alerts at this time" },
      });
    }

    // Check 24-hour cooldown: find notifications created in the last 24 h with our metadata flag
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: recentNotifs } = await supabase
      .from("admin_notifications")
      .select("metadata")
      .gte("created_at", yesterday.toISOString())
      .eq("type", "alert");

    const notifiedProductIds = new Set(
      (recentNotifs ?? [])
        .filter((n) => (n.metadata as any)?.inventory_alert === true)
        .map((n) => (n.metadata as any)?.product_id)
        .filter(Boolean)
    );

    let created = 0;
    let skipped = 0;

    for (const product of alertProducts) {
      // Cooldown: skip if already notified in the last 24 h
      if (notifiedProductIds.has(product.id)) {
        skipped++;
        continue;
      }

      const totalStock = Object.values((product.stocks as Record<string, number>) ?? {})
        .reduce((s, q) => s + (q ?? 0), 0);
      const isCritical = totalStock <= THRESHOLDS.critical;
      const isOut      = totalStock === 0;

      const title   = isOut      ? `🚨 Out of Stock: ${product.name}`
                    : isCritical ? `🚨 Critical Stock: ${product.name}`
                    :              `⚠️ Low Stock: ${product.name}`;

      const message = isOut
        ? `${product.name} is out of stock. Immediate restocking is required.`
        : `${product.name} has only ${totalStock} unit${totalStock === 1 ? "" : "s"} remaining. Please restock soon.`;

      const { error: insertError } = await supabase.from("admin_notifications").insert({
        title,
        message,
        type:            "alert",
        status:          "draft",
        target_audience: "admins",
        recipient_count: 0,
        created_by:      user.id,
        metadata: {
          inventory_alert: true,
          product_id:      product.id,
          current_stock:   totalStock,
          severity:        isCritical ? "critical" : "high",
        },
      });

      if (!insertError) created++;
    }

    return NextResponse.json({
      success: true,
      data: {
        created,
        skipped,
        message: created > 0
          ? `${created} alert notification${created === 1 ? "" : "s"} created${skipped > 0 ? `, ${skipped} skipped (already notified today)` : ""}`
          : "All alerts were already notified today — no new notifications created",
      },
    });

  } catch (error) {
    console.error("[InventoryAlerts POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to push alert notifications" },
      { status: 500 }
    );
  }
}

function buildEmptySummary() {
  return {
    total: 0, critical: 0, high: 0, medium: 0, low: 0,
    alertTypes: {
      outOfStock: 0, criticalStock: 0, lowStock: 0, fastMoving: 0, slowMoving: 0,
    },
    thresholds: THRESHOLDS,
  };
}
