// app/api/admin/reports/inventory-alerts/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const { searchParams } = new URL(request.url);
    const alertType = searchParams.get('type') || 'all';
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get all active products with their stock levels
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, price, images, stocks, sizes, is_active')
      .eq('is_active', true);

    if (error) throw error;

    // Calculate 30-day sales velocity for each product
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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
      .gte('orders.created_at', thirtyDaysAgo.toISOString())
      .neq('orders.order_status', 'Cancelled');

    // Calculate velocity for each product
    const salesVelocity: Record<string, number> = {};
    recentSales?.forEach(item => {
      if (!salesVelocity[item.product_id]) {
        salesVelocity[item.product_id] = 0;
      }
      salesVelocity[item.product_id] += Number(item.quantity);
    });

    // Generate alerts
    const alerts = products?.flatMap(product => {
      const productAlerts = [];
      const totalStock = product.stocks 
        ? Object.values(product.stocks as Record<string, number>)
            .reduce((sum: number, stock: number) => sum + stock, 0)
        : 0;

      const velocity = (salesVelocity[product.id] || 0) / 30; // units per day
      const daysUntilStockout = velocity > 0 ? Math.floor(totalStock / velocity) : Infinity;

      // Low stock alert
      if (totalStock < 10) {
        productAlerts.push({
          id: `${product.id}-low-stock`,
          productId: product.id,
          productName: product.name,
          productImage: product.images?.[0] || null,
          alertType: 'low_stock',
          severity: totalStock === 0 ? 'critical' : totalStock < 5 ? 'high' : 'medium',
          message: totalStock === 0 
            ? 'Out of stock'
            : `Only ${totalStock} units remaining`,
          currentStock: totalStock,
          velocity: Math.round(velocity * 10) / 10,
          daysUntilStockout: daysUntilStockout === Infinity ? null : daysUntilStockout,
          recommendation: totalStock === 0 
            ? 'Restock immediately'
            : 'Consider restocking soon'
        });
      }

      // Fast-moving with low stock
      if (velocity > 1 && totalStock < 20) {
        productAlerts.push({
          id: `${product.id}-fast-moving`,
          productId: product.id,
          productName: product.name,
          productImage: product.images?.[0] || null,
          alertType: 'fast_moving_low_stock',
          severity: 'high',
          message: `High demand product with ${totalStock} units left`,
          currentStock: totalStock,
          velocity: Math.round(velocity * 10) / 10,
          daysUntilStockout: daysUntilStockout === Infinity ? null : daysUntilStockout,
          recommendation: 'Increase stock to meet demand'
        });
      }

      // Slow-moving with high stock
      if (velocity < 0.1 && totalStock > 50) {
        productAlerts.push({
          id: `${product.id}-slow-moving`,
          productId: product.id,
          productName: product.name,
          productImage: product.images?.[0] || null,
          alertType: 'slow_moving_high_stock',
          severity: 'low',
          message: `Slow sales with ${totalStock} units in stock`,
          currentStock: totalStock,
          velocity: Math.round(velocity * 100) / 100,
          daysUntilStockout: daysUntilStockout === Infinity ? null : daysUntilStockout,
          recommendation: 'Consider promotion or reducing inventory'
        });
      }

      // Stockout risk (< 7 days)
      if (daysUntilStockout < 7 && daysUntilStockout > 0) {
        productAlerts.push({
          id: `${product.id}-stockout-risk`,
          productId: product.id,
          productName: product.name,
          productImage: product.images?.[0] || null,
          alertType: 'stockout_risk',
          severity: daysUntilStockout < 3 ? 'critical' : 'high',
          message: `Will run out in ${daysUntilStockout} days at current rate`,
          currentStock: totalStock,
          velocity: Math.round(velocity * 10) / 10,
          daysUntilStockout,
          recommendation: 'Urgent restock needed'
        });
      }

      return productAlerts;
    }) || [];

    // Filter by alert type if specified
    const filteredAlerts = alertType === 'all' 
      ? alerts 
      : alerts.filter(alert => alert.alertType === alertType);

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sortedAlerts = filteredAlerts
      .sort((a, b) => severityOrder[a.severity as keyof typeof severityOrder] - 
                       severityOrder[b.severity as keyof typeof severityOrder])
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        alerts: sortedAlerts,
        summary: {
          totalAlerts: sortedAlerts.length,
          criticalCount: sortedAlerts.filter(a => a.severity === 'critical').length,
          highCount: sortedAlerts.filter(a => a.severity === 'high').length,
          mediumCount: sortedAlerts.filter(a => a.severity === 'medium').length,
          lowCount: sortedAlerts.filter(a => a.severity === 'low').length,
          alertTypes: {
            lowStock: sortedAlerts.filter(a => a.alertType === 'low_stock').length,
            fastMoving: sortedAlerts.filter(a => a.alertType === 'fast_moving_low_stock').length,
            slowMoving: sortedAlerts.filter(a => a.alertType === 'slow_moving_high_stock').length,
            stockoutRisk: sortedAlerts.filter(a => a.alertType === 'stockout_risk').length
          }
        }
      }
    });

  } catch (error) {
    console.error('Inventory alerts API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch inventory alerts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}