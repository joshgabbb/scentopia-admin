// app/api/admin/analytics/bundle-sales/route.ts
import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "90");

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 1. Fetch all product bundles (active and inactive — for historical tracking)
    const { data: bundles, error: bundlesError } = await supabase
      .from("product_bundles")
      .select(`
        id,
        name,
        bundle_price,
        original_price,
        discount_percentage,
        is_active,
        published_at,
        product1:products!product_bundles_product_1_id_fkey(id, name, price, images),
        product2:products!product_bundles_product_2_id_fkey(id, name, price, images)
      `)
      .order("created_at", { ascending: false });

    if (bundlesError) throw bundlesError;
    if (!bundles || bundles.length === 0) {
      return NextResponse.json({
        success: true,
        data: { bundleSales: [], summary: { totalBundleOrders: 0, totalRevenue: 0, totalBundlesTracked: 0 } },
      });
    }

    // 2. Fetch all orders in the date range with their product IDs
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        created_at,
        order_items!order_items_order_id_fkey(
          product_id,
          quantity,
          item_amount
        )
      `)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .in("order_status", ["Delivered", "Shipped", "Processing", "Pending"]);

    if (ordersError) throw ordersError;

    // 3. Build a map: orderId → { productIds: Set, items: [{productId, amount, quantity}] }
    type OrderEntry = {
      productIds: Set<string>;
      items: { productId: string; amount: number; quantity: number }[];
    };
    const orderMap = new Map<string, OrderEntry>();

    for (const order of orders ?? []) {
      const items = (order.order_items ?? []) as any[];
      const productIds = new Set<string>(items.map((i) => i.product_id as string));
      orderMap.set(order.id, {
        productIds,
        items: items.map((i) => ({
          productId: i.product_id as string,
          amount: Number(i.item_amount) || 0,
          quantity: Number(i.quantity) || 1,
        })),
      });
    }

    // 4. For each bundle, find orders that contain BOTH products
    const bundleSales = bundles.map((bundle: any) => {
      const p1Id = bundle.product1?.id as string;
      const p2Id = bundle.product2?.id as string;

      let timesSold = 0;
      let totalRevenue = 0;

      for (const [, entry] of orderMap) {
        if (entry.productIds.has(p1Id) && entry.productIds.has(p2Id)) {
          timesSold += 1;
          // Sum the item_amount for both products in this order
          for (const item of entry.items) {
            if (item.productId === p1Id || item.productId === p2Id) {
              totalRevenue += item.amount;
            }
          }
        }
      }

      return {
        id: bundle.id,
        name: bundle.name,
        bundlePrice: Number(bundle.bundle_price),
        originalPrice: Number(bundle.original_price),
        discountPercentage: Number(bundle.discount_percentage),
        isActive: bundle.is_active,
        publishedAt: bundle.published_at,
        product1: bundle.product1,
        product2: bundle.product2,
        timesSold,
        totalRevenue,
        avgRevenue: timesSold > 0 ? totalRevenue / timesSold : 0,
      };
    });

    // Sort by timesSold descending
    bundleSales.sort((a, b) => b.timesSold - a.timesSold);

    const summary = {
      totalBundlesTracked: bundleSales.length,
      totalBundleOrders: bundleSales.reduce((s, b) => s + b.timesSold, 0),
      totalRevenue: bundleSales.reduce((s, b) => s + b.totalRevenue, 0),
    };

    return NextResponse.json({ success: true, data: { bundleSales, summary } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch bundle sales" },
      { status: 500 }
    );
  }
}
