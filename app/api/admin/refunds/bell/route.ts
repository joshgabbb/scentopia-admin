// app/api/admin/refunds/bell/route.ts
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/admin/refunds/bell — returns pending refund count + preview list
export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("refunds")
      .select("id, order_id, user_id, reason, amount, created_at")
      .eq("status", "Pending")
      .order("created_at", { ascending: false })
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

    const refunds = rows.map((r: Record<string, unknown>) => {
      const profile = profileMap[r.user_id as string];
      return {
        id: r.id as string,
        orderId: r.order_id as string,
        userName: profile?.full_name || profile?.email || "Customer",
        reason: r.reason as string,
        amount: r.amount as number,
        createdAt: r.created_at as string,
      };
    });

    return NextResponse.json({ count: refunds.length, refunds });
  } catch {
    return NextResponse.json({ count: 0, refunds: [] });
  }
}
