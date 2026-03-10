// app/api/admin/reports/stats/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";


export async function GET() {
  const supabase = await createClient();


  try {
    // 1. Get pending feedback count
    const { count: feedbackCount } = await supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');


    // 2. Get fast-moving items count (sold > 5 units in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);


    const { data: orderItems } = await supabase
      .from('order_items')
      .select(`
        product_id,
        quantity,
        orders!order_items_order_id_fkey(
          created_at,
          order_status
        )
      `)
      .gte('orders.created_at', thirtyDaysAgo.toISOString())
      .neq('orders.order_status', 'Cancelled');


    // Aggregate sales by product
    const productSales: Record<string, number> = {};
    orderItems?.forEach(item => {
      const productId = item.product_id;
      if (!productSales[productId]) {
        productSales[productId] = 0;
      }
      productSales[productId] += Number(item.quantity);
    });


    // Fast Moving = sold ≥ 10 units in last 30 days (matches fast-moving/route.ts threshold)
    const fastMovingCount = Object.values(productSales).filter(qty => qty >= 10).length;


    // 3. Get all active products
    const { data: allProducts } = await supabase
      .from('products')
      .select('id')
      .eq('is_active', true);


    // Calculate slow-moving (products with < 1 sale in 60 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);


    const { data: recentSales } = await supabase
      .from('order_items')
      .select(`
        product_id,
        quantity,
        orders!order_items_order_id_fkey(
          created_at,
          order_status
        )
      `)
      .gte('orders.created_at', sixtyDaysAgo.toISOString())
      .neq('orders.order_status', 'Cancelled');


    const recentProductSales: Record<string, number> = {};
    recentSales?.forEach(item => {
      if (!recentProductSales[item.product_id]) {
        recentProductSales[item.product_id] = 0;
      }
      recentProductSales[item.product_id] += Number(item.quantity);
    });


    // Slow Moving = sold < 10 units in 60 days (< fastMin for 60d period = ceil(60/3) = 20;
    // we use a simpler cutoff here for the dashboard stat card)
    const slowMovingCount = allProducts?.filter(product => {
      const sales = recentProductSales[product.id] || 0;
      return sales < 20; // Less than 20 units sold in 60 days → below fast threshold
    }).length || 0;


    // 4. Get low stock alerts count
    const { data: products } = await supabase
      .from('products')
      .select('stocks')
      .eq('is_active', true);


    // Low Stock = total stock ≤ 20 (matches inventory-alerts/route.ts LOW threshold)
    let lowStockCount = 0;
    products?.forEach(product => {
      const totalStock = product.stocks
        ? Object.values(product.stocks as Record<string, number>)
            .reduce((sum: number, stock: number) => sum + stock, 0)
        : 0;
      if (totalStock <= 20) {
        lowStockCount++;
      }
    });


    // 5. Get pending/draft notifications count
    const { count: notificationsCount } = await supabase
      .from('admin_notifications')
      .select('*', { count: 'exact', head: true })
      .in('status', ['draft', 'scheduled']);


    // 6. Get recent audit logs count (last 30 days)
    const { count: auditLogsCount } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());


    return NextResponse.json({
      success: true,
      data: {
        pendingFeedback: feedbackCount || 0,
        fastMovingItems: fastMovingCount,
        slowMovingItems: slowMovingCount,
        lowStockAlerts: lowStockCount,
        pendingNotifications: notificationsCount || 0,
        auditLogs: auditLogsCount || 0,
      }
    });


  } catch (error) {
    console.error('Reports stats API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch reports statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

