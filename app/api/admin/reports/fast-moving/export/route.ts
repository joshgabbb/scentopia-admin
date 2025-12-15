// app/api/admin/reports/fast-moving/export/route.ts
// Export Fast-Moving Items to CSV

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "30");

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

      const totalRevenue = productOrders.reduce(
        (sum: number, item: any) => sum + (item.item_amount || 0), 0
      );

      const stocksObj = product.stocks || {};
      const totalStock = Object.values(stocksObj).reduce((sum: number, qty: any) => sum + (qty || 0), 0);

      const velocity = totalQuantitySold / days;
      const daysUntilStockout = velocity > 0 ? Math.floor(totalStock / velocity) : 0;

      let status = "healthy";
      if (totalStock === 0) status = "out_of_stock";
      else if (totalStock < 10 || (daysUntilStockout > 0 && daysUntilStockout < 7)) status = "low_stock";

      return {
        name: product.name,
        price: product.price,
        sold: totalQuantitySold,
        revenue: totalRevenue,
        stock: totalStock,
        velocity: velocity.toFixed(2),
        daysLeft: daysUntilStockout,
        status
      };
    })
    .filter(p => p.sold > 0)
    .sort((a, b) => parseFloat(b.velocity) - parseFloat(a.velocity));

    // Create CSV
    const headers = ['Product Name', 'Price', 'Units Sold', 'Revenue', 'Current Stock', 'Velocity (units/day)', 'Days Until Stockout', 'Status'];
    const rows = productsWithMetrics.map(p => [
      `"${p.name}"`,
      p.price,
      p.sold,
      p.revenue,
      p.stock,
      p.velocity,
      p.daysLeft,
      p.status
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="fast-moving-items-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    console.error("Export error:", error);
    return new NextResponse("Export failed", { status: 500 });
  }
}