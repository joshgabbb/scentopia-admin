// app/api/admin/orders/delivered-bell/route.ts
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/admin/orders/delivered-bell — returns orders delivered in the last 48 hours
export async function GET() {
  try {
    const supabase = createAdminClient();
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("orders")
      .select("id, amount, updated_at, delivered_at, user_id")
      .eq("order_status", "Delivered")
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    const rows = data || [];

    // Fetch profiles separately
    const userIds = [...new Set(rows.map((r: Record<string, unknown>) => r.user_id as string))];
    let profileMap: Record<string, { full_name: string | null; email: string | null }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profiles) {
        profileMap = Object.fromEntries(
          profiles.map((p: { id: string; full_name: string | null; email: string | null }) => [p.id, p])
        );
      }
    }

    const items = rows.map((r: Record<string, unknown>) => {
      const profile = profileMap[r.user_id as string];
      const shortId = (r.id as string).substring(0, 8).toUpperCase();
      return {
        id: r.id as string,
        orderId: r.id as string,
        orderNumber: `#${shortId}`,
        userName: profile?.full_name || profile?.email || "Customer",
        amount: r.amount as number,
        deliveredAt: (r.delivered_at ?? r.updated_at) as string,
      };
    });

    return NextResponse.json({ count: items.length, items });
  } catch {
    return NextResponse.json({ count: 0, items: [] });
  }
}
