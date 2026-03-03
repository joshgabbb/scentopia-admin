// app/api/admin/dashboard/analytics/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  try {
    // Get orders from the last 60 days for trend analysis (for month comparison)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Get orders from the last 30 days for trend analysis
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentOrders, error: ordersError } = await supabase
      .from("orders")
      .select("id, amount, created_at, order_status")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: true });

    if (ordersError) throw ordersError;

    // Get all orders for status breakdown
    const { data: allOrders, error: allOrdersError } = await supabase
      .from("orders")
      .select("order_status");

    if (allOrdersError) throw allOrdersError;

    // Get order items for revenue calculation
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select(`
        quantity,
        item_amount,
        product_id
      `);

    // Don't throw on items error - just continue with empty data
    if (itemsError) {
      console.error("Order items fetch error:", itemsError);
    }

    // Get products with their categories for breakdown
    const { data: productsWithCategories } = await supabase
      .from("products")
      .select("id, category_id");

    // Get categories
    const { data: categoriesData } = await supabase
      .from("category")
      .select("id, name");

    // Create lookup maps
    const categoryMap: { [key: string]: string } = {};
    categoriesData?.forEach((cat: any) => {
      categoryMap[cat.id] = cat.name;
    });

    const productCategoryMap: { [key: string]: string } = {};
    productsWithCategories?.forEach((prod: any) => {
      productCategoryMap[prod.id] = categoryMap[prod.category_id] || "Uncategorized";
    });

    // Calculate daily revenue for the last 30 days
    const dailyRevenue: { [key: string]: number } = {};
    const dailyOrders: { [key: string]: number } = {};

    // Initialize all days with 0
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];
      dailyRevenue[dateKey] = 0;
      dailyOrders[dateKey] = 0;
    }

    // Fill in actual data
    recentOrders?.forEach((order) => {
      const dateKey = order.created_at.split("T")[0];
      if (dailyRevenue[dateKey] !== undefined) {
        dailyRevenue[dateKey] += Number(order.amount) || 0;
        dailyOrders[dateKey] += 1;
      }
    });

    // Format for chart - last 14 days for cleaner display
    const revenueTrend = Object.entries(dailyRevenue)
      .slice(-14)
      .map(([date, revenue]) => ({
        date,
        label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue: Math.round(revenue),
        orders: dailyOrders[date] || 0,
      }));

    // Calculate orders by status
    const statusCounts: { [key: string]: number } = {};
    allOrders?.forEach((order) => {
      const status = order.order_status || "Unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      color: getStatusColor(status),
    }));

    // Calculate sales by category
    const categorySales: { [key: string]: { revenue: number; quantity: number } } = {};
    orderItems?.forEach((item: any) => {
      // Use the lookup map to get category name
      const categoryName = productCategoryMap[item.product_id] || "Uncategorized";
      if (!categorySales[categoryName]) {
        categorySales[categoryName] = { revenue: 0, quantity: 0 };
      }
      categorySales[categoryName].revenue += Number(item.item_amount) || 0;
      categorySales[categoryName].quantity += Number(item.quantity) || 0;
    });

    const salesByCategory = Object.entries(categorySales)
      .map(([category, data]) => ({
        category,
        revenue: Math.round(data.revenue),
        quantity: data.quantity,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    // Calculate week-over-week comparison
    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekStart = new Date();
    lastWeekStart.setDate(lastWeekStart.getDate() - 14);

    let thisWeekRevenue = 0;
    let lastWeekRevenue = 0;
    let thisWeekOrders = 0;
    let lastWeekOrders = 0;

    recentOrders?.forEach((order) => {
      const orderDate = new Date(order.created_at);
      const amount = Number(order.amount) || 0;

      if (orderDate >= thisWeekStart) {
        thisWeekRevenue += amount;
        thisWeekOrders += 1;
      } else if (orderDate >= lastWeekStart && orderDate < thisWeekStart) {
        lastWeekRevenue += amount;
        lastWeekOrders += 1;
      }
    });

    const revenueGrowth = lastWeekRevenue > 0
      ? Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100)
      : thisWeekRevenue > 0 ? 100 : 0;

    const ordersGrowth = lastWeekOrders > 0
      ? Math.round(((thisWeekOrders - lastWeekOrders) / lastWeekOrders) * 100)
      : thisWeekOrders > 0 ? 100 : 0;

    // Calculate average order value
    const totalRevenue = recentOrders?.reduce((sum, o) => sum + (Number(o.amount) || 0), 0) || 0;
    const avgOrderValue = recentOrders && recentOrders.length > 0
      ? Math.round(totalRevenue / recentOrders.length)
      : 0;

    // Calculate revenue by day of week
    const revenueByDayOfWeek: { [key: number]: { revenue: number; orders: number } } = {
      0: { revenue: 0, orders: 0 }, // Sunday
      1: { revenue: 0, orders: 0 }, // Monday
      2: { revenue: 0, orders: 0 }, // Tuesday
      3: { revenue: 0, orders: 0 }, // Wednesday
      4: { revenue: 0, orders: 0 }, // Thursday
      5: { revenue: 0, orders: 0 }, // Friday
      6: { revenue: 0, orders: 0 }, // Saturday
    };

    recentOrders?.forEach((order) => {
      const dayOfWeek = new Date(order.created_at).getDay();
      revenueByDayOfWeek[dayOfWeek].revenue += Number(order.amount) || 0;
      revenueByDayOfWeek[dayOfWeek].orders += 1;
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const revenueByDay = Object.entries(revenueByDayOfWeek).map(([day, data]) => ({
      day: dayNames[parseInt(day)],
      revenue: Math.round(data.revenue),
      orders: data.orders,
    }));

    // Calculate monthly comparison (this month vs last month)
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    let thisMonthRevenue = 0;
    let lastMonthRevenue = 0;
    let thisMonthOrders = 0;
    let lastMonthOrders = 0;

    recentOrders?.forEach((order) => {
      const orderDate = new Date(order.created_at);
      const amount = Number(order.amount) || 0;

      if (orderDate >= thisMonthStart) {
        thisMonthRevenue += amount;
        thisMonthOrders += 1;
      } else if (orderDate >= lastMonthStart && orderDate <= lastMonthEnd) {
        lastMonthRevenue += amount;
        lastMonthOrders += 1;
      }
    });

    const monthlyComparison = [
      { month: 'Last Month', revenue: Math.round(lastMonthRevenue), orders: lastMonthOrders },
      { month: 'This Month', revenue: Math.round(thisMonthRevenue), orders: thisMonthOrders },
    ];

    // Get inventory status
    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, stocks, is_active")
      .eq("is_active", true);

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let healthyStockCount = 0;

    productsData?.forEach((product: any) => {
      const stocks = product.stocks || {};
      const totalStock = Object.values(stocks).reduce((sum: number, qty: any) => sum + (Number(qty) || 0), 0);

      if (totalStock === 0) {
        outOfStockCount++;
      } else if (totalStock < 10) {
        lowStockCount++;
      } else {
        healthyStockCount++;
      }
    });

    const inventoryStatus = {
      total: productsData?.length || 0,
      healthy: healthyStockCount,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
      healthyPercent: productsData?.length ? Math.round((healthyStockCount / productsData.length) * 100) : 0,
    };

    // Calculate order fulfillment rate
    const deliveredOrders = allOrders?.filter((o) => o.order_status === 'Delivered').length || 0;
    const cancelledOrders = allOrders?.filter((o) => o.order_status === 'Cancelled').length || 0;
    const totalCompletedOrders = deliveredOrders + cancelledOrders;
    const fulfillmentRate = totalCompletedOrders > 0
      ? Math.round((deliveredOrders / totalCompletedOrders) * 100)
      : 100;

    // Calculate hourly sales distribution (for peak hours)
    const hourlyOrders: { [key: number]: number } = {};
    for (let i = 0; i < 24; i++) {
      hourlyOrders[i] = 0;
    }

    recentOrders?.forEach((order) => {
      const hour = new Date(order.created_at).getHours();
      hourlyOrders[hour] += 1;
    });

    const peakHours = Object.entries(hourlyOrders)
      .map(([hour, count]) => ({ hour: parseInt(hour), orders: count }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 3);

    // Performance metrics
    const performanceMetrics = {
      conversionRate: 0, // Would need visitor data
      avgItemsPerOrder: 0,
      repeatCustomerRate: 0,
    };

    // Get average items per order
    const { data: orderItemsCount } = await supabase
      .from("order_items")
      .select("order_id, quantity");

    if (orderItemsCount && orderItemsCount.length > 0) {
      const orderItemTotals: { [key: string]: number } = {};
      orderItemsCount.forEach((item: any) => {
        orderItemTotals[item.order_id] = (orderItemTotals[item.order_id] || 0) + (Number(item.quantity) || 0);
      });
      const totalItems = Object.values(orderItemTotals).reduce((sum, qty) => sum + qty, 0);
      performanceMetrics.avgItemsPerOrder = Math.round((totalItems / Object.keys(orderItemTotals).length) * 10) / 10;
    }

    return NextResponse.json({
      success: true,
      data: {
        revenueTrend,
        ordersByStatus,
        salesByCategory,
        revenueByDay,
        monthlyComparison,
        inventoryStatus,
        fulfillmentRate,
        peakHours,
        performanceMetrics,
        summary: {
          thisWeekRevenue: Math.round(thisWeekRevenue),
          lastWeekRevenue: Math.round(lastWeekRevenue),
          revenueGrowth,
          thisWeekOrders,
          lastWeekOrders,
          ordersGrowth,
          avgOrderValue,
          totalOrdersLast30Days: recentOrders?.length || 0,
          thisMonthRevenue: Math.round(thisMonthRevenue),
          lastMonthRevenue: Math.round(lastMonthRevenue),
          monthlyGrowth: lastMonthRevenue > 0
            ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
            : thisMonthRevenue > 0 ? 100 : 0,
        },
      },
    });
  } catch (error) {
    console.error("Dashboard Analytics API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch analytics data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function getStatusColor(status: string): string {
  const colors: { [key: string]: string } = {
    Pending: "#f59e0b",
    Processing: "#3b82f6",
    Shipped: "#8b5cf6",
    Delivered: "#22c55e",
    Cancelled: "#ef4444",
    Refunded: "#6b7280",
  };
  return colors[status] || "#d4af37";
}
