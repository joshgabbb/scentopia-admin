// app/api/admin/reports/slow-moving/export/route.ts
// Export Slow-Moving Items to CSV

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "60");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateISO = startDate.toISOString();

    // Get all products
    const { data: allProducts } = await supabase.from('products').select('*');
    if (!allProducts) {
      return new NextResponse("No data to export", { status: 404 });
    }

    // Get order items
    const { data: orderItems } = await supabase
      .from('order_items')
      .select(`*, orders (id, order_status, created_at)`)
      .gte('created_at', startDateISO);

    // Calculate metrics
    const productsWithMetrics = allProducts.map(product => {
      const productOrders = (orderItems || []).filter((item: any) => {
        const matchesProduct = item.product_id === product.id;
        const validStatuses = ['Delivered', 'Confirmed', 'Processing', 'Pending', 'Shipped'];
        const hasValidStatus = validStatuses.includes(item.orders?.order_status);
        return matchesProduct && hasValidStatus;
      });

      const totalQuantitySold = productOrders.reduce(
        (sum: number, item: any) => sum + (item.quantity || 0), 0
      );

      const stocksObj = product.stocks || {};
      const totalStock = Object.values(stocksObj).reduce((sum: number, qty: any) => sum + (qty || 0), 0);

      const velocity = totalQuantitySold / days;
      const daysOfInventory = velocity > 0 ? Math.floor(totalStock / velocity) : 999;

      const productAge = Math.floor(
        (Date.now() - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      let status = "slow";
      let recommendation = "monitor";

      if (totalQuantitySold === 0) {
        status = "no_sales";
        recommendation = "consider_discontinuing";
      } else if (velocity < 0.1) {
        status = "very_slow";
        recommendation = "reduce_inventory";
      } else if (velocity < 1.0) {
        status = "slow";
        recommendation = "promote_product";
      }

      return {
        name: product.name,
        price: product.price,
        sold: totalQuantitySold,
        stock: totalStock,
        velocity: velocity.toFixed(3),
        daysOfInventory,
        age: productAge,
        stockValue: totalStock * (product.price || 0),
        status,
        recommendation
      };
    })
    .filter(p => parseFloat(p.velocity) < 1.0)
    .sort((a, b) => parseFloat(a.velocity) - parseFloat(b.velocity));

    // Create CSV
    const headers = ['Product Name', 'Price', 'Units Sold', 'Current Stock', 'Velocity (units/day)', 'Days of Inventory', 'Age (days)', 'Stock Value', 'Status', 'Recommendation'];
    const rows = productsWithMetrics.map(p => [
      `"${p.name}"`,
      p.price,
      p.sold,
      p.stock,
      p.velocity,
      p.daysOfInventory,
      p.age,
      p.stockValue.toFixed(2),
      p.status,
      p.recommendation
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="slow-moving-items-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    console.error("Export error:", error);
    return new NextResponse("Export failed", { status: 500 });
  }
}