// app/api/admin/reports/inventory-alerts/export/route.ts
// CORRECTED VERSION - Respects filter parameter

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const filterType = searchParams.get("filter") || "all";

    console.log("=== EXPORT INVENTORY ALERTS ===");
    console.log("Filter:", filterType);

    // Get all products
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true);

    if (!products) {
      return new NextResponse("No data to export", { status: 404 });
    }

    // Calculate 30-day velocity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentOrderItems } = await supabase
      .from('order_items')
      .select(`*, orders (id, order_status, created_at)`)
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Calculate velocity
    const productVelocities: { [key: string]: number } = {};
    (recentOrderItems || []).forEach((item: any) => {
      const validStatuses = ['Delivered', 'Confirmed', 'Processing', 'Pending', 'Shipped'];
      if (validStatuses.includes(item.orders?.order_status)) {
        if (!productVelocities[item.product_id]) {
          productVelocities[item.product_id] = 0;
        }
        productVelocities[item.product_id] += item.quantity || 0;
      }
    });

    // Create alerts
    const allAlerts = products.map(product => {
      const stocksObj = product.stocks || {};
      const totalStock = Object.values(stocksObj).reduce((sum: number, qty: any) => sum + (qty || 0), 0);

      const unitsSoldLast30Days = productVelocities[product.id] || 0;
      const velocity = unitsSoldLast30Days / 30;
      const daysUntilStockout = velocity > 0 ? Math.floor(totalStock / velocity) : 999;

      let severity: "critical" | "high" | "medium" | "low" = "low";
      let type: "stockout_risk" | "low_stock" | "fast_moving" | "slow_moving" = "low_stock";
      let message = "";

      if (totalStock === 0) {
        severity = "critical";
        type = "stockout_risk";
        message = "Out of stock! Immediate restocking required.";
      } else if (totalStock <= 5) {
        severity = "critical";
        type = "stockout_risk";
        message = `Only ${totalStock} units left. Critical stock level!`;
      } else if (daysUntilStockout > 0 && daysUntilStockout <= 7) {
        severity = "high";
        type = "stockout_risk";
        message = `Will run out in ${daysUntilStockout} days at current sales rate.`;
      } else if (totalStock <= 20) {
        severity = "high";
        type = "low_stock";
        message = `Low stock: ${totalStock} units remaining.`;
      } else if (velocity > 2.0) {
        severity = "medium";
        type = "fast_moving";
        message = `Fast-moving product. Consider increasing inventory.`;
      } else if (totalStock <= 50) {
        severity = "medium";
        type = "low_stock";
        message = `Moderate stock: ${totalStock} units remaining.`;
      } else if (velocity < 0.5 && totalStock > 50) {
        severity = "low";
        type = "slow_moving";
        message = `Slow-moving product with high inventory.`;
      } else {
        severity = "low";
        type = "low_stock";
        message = `Stock level normal: ${totalStock} units.`;
      }

      return {
        name: product.name,
        stock: totalStock,
        velocity: velocity.toFixed(2),
        daysLeft: daysUntilStockout === 999 ? 'N/A' : daysUntilStockout,
        unitsSold30d: unitsSoldLast30Days,
        severity,
        type,
        message
      };
    });

    // FIX: Apply filter based on type parameter
    let filteredAlerts = allAlerts;
    if (filterType === "low_stock") {
      filteredAlerts = allAlerts.filter(a => a.type === "low_stock");
    } else if (filterType === "fast_moving") {
      filteredAlerts = allAlerts.filter(a => a.type === "fast_moving");
    } else if (filterType === "slow_moving") {
      filteredAlerts = allAlerts.filter(a => a.type === "slow_moving");
    } else if (filterType === "stockout_risk") {
      filteredAlerts = allAlerts.filter(a => a.type === "stockout_risk");
    }

    console.log("Total alerts:", allAlerts.length);
    console.log("Filtered alerts:", filteredAlerts.length);

    // Sort by severity
    const severityOrder: any = { critical: 0, high: 1, medium: 2, low: 3 };
    filteredAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Create CSV
    const headers = ['Product Name', 'Current Stock', 'Velocity (units/day)', 'Days Until Stockout', 'Units Sold (30d)', 'Severity', 'Type', 'Message'];
    const rows = filteredAlerts.map(a => [
      `"${a.name}"`,
      a.stock,
      a.velocity,
      a.daysLeft,
      a.unitsSold30d,
      a.severity,
      a.type,
      `"${a.message}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="inventory-alerts-${filterType}-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    console.error("Export error:", error);
    return new NextResponse("Export failed", { status: 500 });
  }
}