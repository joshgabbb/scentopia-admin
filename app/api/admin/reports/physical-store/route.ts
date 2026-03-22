// app/api/admin/reports/physical-store/route.ts
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
      return await getPOSSalesByProduct(supabase, dateFilter);
    } else {
      return await getPOSSalesByPeriod(supabase, type as "daily" | "weekly" | "monthly", dateFilter);
    }
  } catch (error) {
    console.error("❌ Physical Store Report API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch physical store report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function getPOSSalesByPeriod(
  supabase: any,
  period: "daily" | "weekly" | "monthly",
  dateFilter: { from?: string; to?: string }
) {
  let query = supabase
    .from("pos_transactions")
    .select(`
      id,
      total_amount,
      created_at,
      pos_transaction_items!pos_transaction_items_transaction_id_fkey(
        quantity
      )
    `)
    .order("created_at", { ascending: false });

  if (dateFilter.from) query = query.gte("created_at", dateFilter.from);
  if (dateFilter.to) query = query.lte("created_at", dateFilter.to + "T23:59:59");

  const { data: transactions, error } = await query;
  if (error) throw error;

  const aggregated: Record<string, { txCount: number; revenue: number; itemsSold: number }> = {};

  transactions?.forEach((tx: any) => {
    const date = new Date(tx.created_at);
    let periodKey: string;

    if (period === "daily") {
      periodKey = date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } else if (period === "weekly") {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      periodKey = `Week of ${startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    } else {
      periodKey = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    }

    if (!aggregated[periodKey]) {
      aggregated[periodKey] = { txCount: 0, revenue: 0, itemsSold: 0 };
    }

    aggregated[periodKey].txCount += 1;
    aggregated[periodKey].revenue += Number(tx.total_amount) || 0;
    aggregated[periodKey].itemsSold +=
      tx.pos_transaction_items?.reduce(
        (sum: number, item: any) => sum + (Number(item.quantity) || 0),
        0
      ) || 0;
  });

  const salesData = Object.entries(aggregated).map(([period, data]) => ({
    period,
    orderCount: data.txCount,
    revenue: data.revenue,
    averageOrderValue: data.revenue / (data.txCount || 1),
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

async function getPOSSalesByProduct(
  supabase: any,
  dateFilter: { from?: string; to?: string }
) {
  let query = supabase
    .from("pos_transaction_items")
    .select(`
      product_id,
      product_name,
      quantity,
      unit_price,
      subtotal,
      pos_transactions!pos_transaction_items_transaction_id_fkey(
        created_at
      )
    `);

  const { data: items, error } = await query;
  if (error) throw error;

  // Filter by date
  const filtered = items?.filter((item: any) => {
    const tx = item.pos_transactions;
    if (!tx) return false;
    const date = new Date(tx.created_at);
    if (dateFilter.from && date < new Date(dateFilter.from)) return false;
    if (dateFilter.to && date > new Date(dateFilter.to + "T23:59:59")) return false;
    return true;
  }) || [];

  const productStats: Record<string, { name: string; quantitySold: number; revenue: number }> = {};

  filtered.forEach((item: any) => {
    const key = item.product_id || item.product_name;
    const qty = Number(item.quantity) || 0;
    const rev = Number(item.subtotal) || 0;

    if (!productStats[key]) {
      productStats[key] = { name: item.product_name, quantitySold: 0, revenue: 0 };
    }
    productStats[key].quantitySold += qty;
    productStats[key].revenue += rev;
  });

  const products = Object.values(productStats)
    .map((p) => ({ ...p, category: "Physical Store" }))
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
