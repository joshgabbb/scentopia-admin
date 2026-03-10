// app/api/admin/dashboard/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Initialize Supabase client

export async function GET() {
  const supabase = await createClient();

  try {
    // Get total users count
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    // Get total orders count and revenue
    const { data: ordersData, count: totalOrders } = await supabase
      .from("orders")
      .select("amount", { count: "exact" });

    const revenue =
      ordersData?.reduce((sum, order) => sum + Number(order.amount), 0) || 0;

    // Get total products count
    const { count: totalProducts } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    // Get recent orders with customer info
    const { data: recentOrders } = await supabase
      .from("orders")
      .select(
        `
        id,
        amount,
        created_at,
        order_status,
        profiles!orders_user_id_fkey(first_name, last_name)
      `
      )
      .order("created_at", { ascending: false })
      .limit(5);

    // Get top products by order items
    const { data: topProductsData } = await supabase.from("order_items")
      .select(`
        product_id,
        quantity,
        products!order_items_product_id_fkey(name, price)
      `);

    // Calculate top products
    const productStats = topProductsData?.reduce((acc: any, item: any) => {
      const productId = item.product_id;
      if (!acc[productId]) {
        acc[productId] = {
          id: productId,
          name: item.products.name,
          price: item.products.price,
          soldCount: 0,
        };
      }
      acc[productId].soldCount += Number(item.quantity);
      return acc;
    }, {});

    const topProducts = Object.values(productStats || {})
      .sort((a: any, b: any) => b.soldCount - a.soldCount)
      .slice(0, 5);

    // Calculate growth percentages (simplified - you'd compare with previous period)
    const stats = {
      totalUsers: totalUsers || 0,
      totalOrders: totalOrders || 0,
      revenue: revenue,
      totalProducts: totalProducts || 0,
      userGrowth: 12, // You'd calculate this by comparing with previous month
      orderGrowth: 8,
      revenueGrowth: 15,
      productGrowth: -2,
    };

    const formattedRecentOrders =
      recentOrders?.map((order) => {
        const profile = order.profiles as {
          first_name?: string;
          last_name?: string;
        } | null;

        return {
          id: order.id,
          amount: Number(order.amount),
          customerName: profile
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
              "Unknown Customer"
            : "Unknown Customer",
          status: order.order_status,
          createdAt: order.created_at,
        };
      }) || [];

    return NextResponse.json({
      success: true,
      data: {
        stats,
        recentOrders: formattedRecentOrders,
        topProducts: topProducts || [],
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch dashboard data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
