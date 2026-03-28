// app/api/admin/reports/sales/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'daily'; // daily | weekly | monthly | by-category | by-product
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    console.log('📊 Sales Report API called with params:', { type, from, to });

    // Build date filter
    let dateFilter: { from?: string; to?: string } = {};
    if (from) dateFilter.from = from;
    if (to) dateFilter.to = to;

    if (type === 'by-category') {
      return await getSalesByCategory(supabase, dateFilter);
    } else if (type === 'by-product') {
      return await getSalesByProduct(supabase, dateFilter);
    } else {
      return await getSalesByPeriod(supabase, type as 'daily' | 'weekly' | 'monthly', dateFilter);
    }
  } catch (error) {
    console.error('❌ Sales Report API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sales report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function getSalesByPeriod(
  supabase: any,
  period: 'daily' | 'weekly' | 'monthly',
  dateFilter: { from?: string; to?: string }
) {
  // Get orders with items
  let query = supabase
    .from('orders')
    .select(`
      id,
      amount,
      created_at,
      order_status,
      order_items!order_items_order_id_fkey(
        quantity
      )
    `)
    .not('order_status', 'eq', 'Cancelled');

  if (dateFilter.from) {
    query = query.gte('created_at', dateFilter.from);
  }
  if (dateFilter.to) {
    query = query.lte('created_at', dateFilter.to + 'T23:59:59');
  }

  query = query.order('created_at', { ascending: false });

  const { data: orders, error } = await query;

  if (error) throw error;

  // Aggregate by period
  const aggregated: Record<string, { orderCount: number; revenue: number; itemsSold: number }> = {};

  orders?.forEach((order: any) => {
    if (order.order_status === 'Refunded') return;
    const date = new Date(order.created_at);
    let periodKey: string;

    if (period === 'daily') {
      periodKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } else if (period === 'weekly') {
      // Get start of week (Sunday)
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      periodKey = `Week of ${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      periodKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    }

    if (!aggregated[periodKey]) {
      aggregated[periodKey] = { orderCount: 0, revenue: 0, itemsSold: 0 };
    }

    aggregated[periodKey].orderCount += 1;
    aggregated[periodKey].revenue += Number(order.amount) || 0;
    aggregated[periodKey].itemsSold += order.order_items?.reduce(
      (sum: number, item: any) => sum + (Number(item.quantity) || 0),
      0
    ) || 0;
  });

  const salesData = Object.entries(aggregated).map(([period, data]) => ({
    period,
    orderCount: data.orderCount,
    revenue: data.revenue,
    averageOrderValue: data.revenue / (data.orderCount || 1),
    itemsSold: data.itemsSold,
  }));

  const totalRevenue = salesData.reduce((sum, s) => sum + s.revenue, 0);
  const totalOrders = salesData.reduce((sum, s) => sum + s.orderCount, 0);

  return NextResponse.json({
    success: true,
    data: {
      sales: salesData,
      summary: {
        totalRevenue,
        totalOrders,
        averageOrderValue: totalRevenue / (totalOrders || 1),
        periods: salesData.length,
      },
    },
  });
}

async function getSalesByCategory(
  supabase: any,
  dateFilter: { from?: string; to?: string }
) {
  // Get order items with product categories
  let query = supabase
    .from('order_items')
    .select(`
      quantity,
      item_amount,
      products!order_items_product_id_fkey(
        name,
        price,
        category!products_category_id_fkey(
          name
        )
      ),
      orders!order_items_order_id_fkey(
        created_at,
        order_status
      )
    `);

  const { data: orderItems, error } = await query;

  if (error) throw error;

  // Filter by date and non-cancelled status
  const filteredItems = orderItems?.filter((item: any) => {
    const order = item.orders;
    if (!order || order.order_status === 'Cancelled' || order.order_status === 'Refunded') return false;

    const orderDate = new Date(order.created_at);
    if (dateFilter.from && orderDate < new Date(dateFilter.from)) return false;
    if (dateFilter.to && orderDate > new Date(dateFilter.to + 'T23:59:59')) return false;

    return true;
  }) || [];

  // Aggregate by category
  const categoryStats: Record<string, { productsSold: number; revenue: number; prices: number[] }> = {};

  filteredItems.forEach((item: any) => {
    const categoryName = item.products?.category?.name || 'Uncategorized';
    const quantity = Number(item.quantity) || 0;
    const revenue = Number(item.item_amount) || 0;
    const price = Number(item.products?.price) || 0;

    if (!categoryStats[categoryName]) {
      categoryStats[categoryName] = { productsSold: 0, revenue: 0, prices: [] };
    }

    categoryStats[categoryName].productsSold += quantity;
    categoryStats[categoryName].revenue += revenue;
    if (price > 0) categoryStats[categoryName].prices.push(price);
  });

  const categories = Object.entries(categoryStats)
    .map(([name, stats]) => ({
      name,
      productsSold: stats.productsSold,
      revenue: stats.revenue,
      averagePrice: stats.prices.length > 0
        ? stats.prices.reduce((a, b) => a + b, 0) / stats.prices.length
        : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = categories.reduce((sum, c) => sum + c.revenue, 0);

  return NextResponse.json({
    success: true,
    data: {
      categories,
      summary: {
        totalRevenue,
        categoryCount: categories.length,
      },
    },
  });
}

async function getSalesByProduct(
  supabase: any,
  dateFilter: { from?: string; to?: string }
) {
  // Get order items with products
  let query = supabase
    .from('order_items')
    .select(`
      quantity,
      item_amount,
      products!order_items_product_id_fkey(
        id,
        name,
        price,
        category!products_category_id_fkey(
          name
        )
      ),
      orders!order_items_order_id_fkey(
        created_at,
        order_status
      )
    `);

  const { data: orderItems, error } = await query;

  if (error) throw error;

  // Filter by date and non-cancelled status
  const filteredItems = orderItems?.filter((item: any) => {
    const order = item.orders;
    if (!order || order.order_status === 'Cancelled' || order.order_status === 'Refunded') return false;

    const orderDate = new Date(order.created_at);
    if (dateFilter.from && orderDate < new Date(dateFilter.from)) return false;
    if (dateFilter.to && orderDate > new Date(dateFilter.to + 'T23:59:59')) return false;

    return true;
  }) || [];

  // Aggregate by product
  const productStats: Record<string, {
    name: string;
    category: string;
    quantitySold: number;
    revenue: number;
    price: number;
  }> = {};

  filteredItems.forEach((item: any) => {
    const productId = item.products?.id;
    if (!productId) return;

    const quantity = Number(item.quantity) || 0;
    const revenue = Number(item.item_amount) || 0;

    if (!productStats[productId]) {
      productStats[productId] = {
        name: item.products.name,
        category: item.products.category?.name || 'Uncategorized',
        quantitySold: 0,
        revenue: 0,
        price: Number(item.products.price) || 0,
      };
    }

    productStats[productId].quantitySold += quantity;
    productStats[productId].revenue += revenue;
  });

  const products = Object.values(productStats)
    .map((stats) => ({
      ...stats,
      averagePrice: stats.revenue / (stats.quantitySold || 1),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);
  const totalSold = products.reduce((sum, p) => sum + p.quantitySold, 0);

  return NextResponse.json({
    success: true,
    data: {
      products,
      summary: {
        totalRevenue,
        totalUnitsSold: totalSold,
        productCount: products.length,
      },
    },
  });
}
