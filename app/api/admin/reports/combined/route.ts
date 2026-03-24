// app/api/admin/reports/combined/route.ts
// Merges Mobile App sales (orders) + Physical Store sales (pos_transactions)
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "daily"; // daily | weekly | monthly | by-product
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const dateFilter: { from?: string; to?: string } = {};
    if (from) dateFilter.from = from;
    if (to) dateFilter.to = to;

    if (type === "by-product") {
      return await getCombinedByProduct(supabase, dateFilter);
    } else {
      return await getCombinedByPeriod(supabase, type as "daily" | "weekly" | "monthly", dateFilter);
    }
  } catch (error) {
    console.error("❌ Combined Report API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch combined report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function getPeriodKey(date: Date, period: "daily" | "weekly" | "monthly"): string {
  if (period === "daily") {
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  if (period === "weekly") {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    return `Week of ${startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

async function getCombinedByPeriod(
  supabase: any,
  period: "daily" | "weekly" | "monthly",
  dateFilter: { from?: string; to?: string }
) {
  // ── 1. Fetch mobile app orders ──────────────────────────────────────
  let ordersQuery = supabase
    .from("orders")
    .select(`
      id,
      amount,
      created_at,
      order_status,
      order_items!order_items_order_id_fkey(quantity)
    `)
    .not("order_status", "eq", "Cancelled");

  if (dateFilter.from) ordersQuery = ordersQuery.gte("created_at", dateFilter.from);
  if (dateFilter.to) ordersQuery = ordersQuery.lte("created_at", dateFilter.to + "T23:59:59");

  // ── 2. Fetch physical store transactions ────────────────────────────
  let posQuery = supabase
    .from("pos_transactions")
    .select(`
      id,
      total_amount,
      created_at,
      pos_transaction_items!pos_transaction_items_transaction_id_fkey(quantity)
    `);

  if (dateFilter.from) posQuery = posQuery.gte("created_at", dateFilter.from);
  if (dateFilter.to) posQuery = posQuery.lte("created_at", dateFilter.to + "T23:59:59");

  const [{ data: orders, error: ordersError }, { data: posTx, error: posError }] =
    await Promise.all([ordersQuery, posQuery]);

  if (ordersError) throw ordersError;
  if (posError) throw posError;

  const aggregated: Record<string, {
    appCount: number;
    storeCount: number;
    revenue: number;
    itemsSold: number;
  }> = {};

  const ensurePeriod = (key: string) => {
    if (!aggregated[key]) {
      aggregated[key] = { appCount: 0, storeCount: 0, revenue: 0, itemsSold: 0 };
    }
  };

  // Aggregate mobile orders
  orders?.forEach((order: any) => {
    if (order.order_status === "Refunded") return;
    const key = getPeriodKey(new Date(order.created_at), period);
    ensurePeriod(key);
    aggregated[key].appCount += 1;
    aggregated[key].revenue += Number(order.amount) || 0;
    aggregated[key].itemsSold +=
      order.order_items?.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0) || 0;
  });

  // Aggregate physical store transactions
  posTx?.forEach((tx: any) => {
    const key = getPeriodKey(new Date(tx.created_at), period);
    ensurePeriod(key);
    aggregated[key].storeCount += 1;
    aggregated[key].revenue += Number(tx.total_amount) || 0;
    aggregated[key].itemsSold +=
      tx.pos_transaction_items?.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0) || 0;
  });

  const salesData = Object.entries(aggregated)
    .map(([p, data]) => ({
      period: p,
      orderCount: data.appCount + data.storeCount,
      appOrders: data.appCount,
      storeOrders: data.storeCount,
      revenue: data.revenue,
      averageOrderValue: data.revenue / ((data.appCount + data.storeCount) || 1),
      itemsSold: data.itemsSold,
    }))
    .sort((a, b) => {
      // Sort descending by first date found in period label
      const dateA = new Date(a.period.replace("Week of ", ""));
      const dateB = new Date(b.period.replace("Week of ", ""));
      return dateB.getTime() - dateA.getTime();
    });

  const totalRevenue = salesData.reduce((sum, s) => sum + s.revenue, 0);
  const totalOrders = salesData.reduce((sum, s) => sum + s.orderCount, 0);
  const totalApp = salesData.reduce((sum, s) => sum + s.appOrders, 0);
  const totalStore = salesData.reduce((sum, s) => sum + s.storeOrders, 0);

  return NextResponse.json({
    success: true,
    data: {
      sales: salesData,
      summary: {
        totalRevenue,
        totalOrders,
        averageOrderValue: totalRevenue / (totalOrders || 1),
        periods: salesData.length,
        appOrders: totalApp,
        storeOrders: totalStore,
      },
    },
  });
}

async function getCombinedByProduct(
  supabase: any,
  dateFilter: { from?: string; to?: string }
) {
  // ── Mobile app: order_items ─────────────────────────────────────────
  let appItemsQuery = supabase
    .from("order_items")
    .select(`
      quantity,
      item_amount,
      products!order_items_product_id_fkey(id, name),
      orders!order_items_order_id_fkey(created_at, order_status)
    `);

  // ── Physical store: pos_transaction_items ───────────────────────────
  let posItemsQuery = supabase
    .from("pos_transaction_items")
    .select(`
      product_id,
      product_name,
      quantity,
      subtotal,
      pos_transactions!pos_transaction_items_transaction_id_fkey(created_at)
    `);

  const [{ data: appItems, error: appError }, { data: posItems, error: posError }] =
    await Promise.all([appItemsQuery, posItemsQuery]);

  if (appError) throw appError;
  if (posError) throw posError;

  const productStats: Record<string, {
    name: string;
    quantitySold: number;
    revenue: number;
    appQty: number;
    storeQty: number;
  }> = {};

  const ensureProduct = (key: string, name: string) => {
    if (!productStats[key]) {
      productStats[key] = { name, quantitySold: 0, revenue: 0, appQty: 0, storeQty: 0 };
    }
  };

  // Process mobile app items
  appItems?.forEach((item: any) => {
    const order = item.orders;
    if (!order || order.order_status === "Cancelled" || order.order_status === "Refunded") return;

    const date = new Date(order.created_at);
    if (dateFilter.from && date < new Date(dateFilter.from)) return;
    if (dateFilter.to && date > new Date(dateFilter.to + "T23:59:59")) return;

    const key = item.products?.id || "unknown";
    const name = item.products?.name || "Unknown Product";
    ensureProduct(key, name);
    productStats[key].quantitySold += Number(item.quantity) || 0;
    productStats[key].revenue += Number(item.item_amount) || 0;
    productStats[key].appQty += Number(item.quantity) || 0;
  });

  // Process physical store items
  posItems?.forEach((item: any) => {
    const tx = item.pos_transactions;
    if (!tx) return;

    const date = new Date(tx.created_at);
    if (dateFilter.from && date < new Date(dateFilter.from)) return;
    if (dateFilter.to && date > new Date(dateFilter.to + "T23:59:59")) return;

    // Use product_id if available, otherwise fall back to product_name as key
    const key = item.product_id || `store-${item.product_name}`;
    const name = item.product_name || "Unknown Product";
    ensureProduct(key, name);
    productStats[key].quantitySold += Number(item.quantity) || 0;
    productStats[key].revenue += Number(item.subtotal) || 0;
    productStats[key].storeQty += Number(item.quantity) || 0;
  });

  const products = Object.values(productStats)
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
