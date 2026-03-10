// app/api/admin/alerts/bell/route.ts
//
// Lightweight endpoint for the notification bell in the admin header.
// Returns real-time stock alert counts and the top 6 alerts to display in
// the dropdown.  Requires auth; returns empty payload on failure to avoid
// breaking the layout render.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CRITICAL = 5;
const LOW      = 20;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Return empty gracefully if not authenticated (layout still renders)
    if (!user) {
      return NextResponse.json({ count: 0, criticalCount: 0, alerts: [] });
    }

    const { data: products } = await supabase
      .from("products")
      .select("id, name, stocks")
      .eq("is_active", true);

    if (!products?.length) {
      return NextResponse.json({ count: 0, criticalCount: 0, alerts: [] });
    }

    type BellAlert = {
      id:          string;
      productName: string;
      message:     string;
      severity:    "critical" | "high";
      stock:       number;
    };

    const alerts: BellAlert[] = [];

    for (const p of products) {
      const totalStock = Object.values((p.stocks as Record<string, number>) ?? {})
        .reduce((s, q) => s + (q ?? 0), 0);

      if (totalStock === 0) {
        alerts.push({ id: p.id, productName: p.name, message: "Out of stock — restock immediately", severity: "critical", stock: 0 });
      } else if (totalStock <= CRITICAL) {
        alerts.push({ id: p.id, productName: p.name, message: `Only ${totalStock} unit${totalStock === 1 ? "" : "s"} left — critical`, severity: "critical", stock: totalStock });
      } else if (totalStock <= LOW) {
        alerts.push({ id: p.id, productName: p.name, message: `${totalStock} units remaining — low stock`, severity: "high", stock: totalStock });
      }
    }

    // Sort: critical first, then by lowest stock
    alerts.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
      return a.stock - b.stock;
    });

    const criticalCount = alerts.filter((a) => a.severity === "critical").length;

    return NextResponse.json({
      count:         alerts.length,
      criticalCount,
      alerts:        alerts.slice(0, 6),
    });

  } catch (error) {
    console.error("[BellAlerts]", error);
    // Never crash the layout — return empty payload
    return NextResponse.json({ count: 0, criticalCount: 0, alerts: [] });
  }
}
