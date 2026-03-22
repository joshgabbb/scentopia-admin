import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET: single voucher with usage history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authClient = await createClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  try {
    const { data: voucher, error } = await supabase
      .from("vouchers")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !voucher) {
      return NextResponse.json({ success: false, error: "Voucher not found" }, { status: 404 });
    }

    const { data: usage } = await supabase
      .from("voucher_usage")
      .select("*, profiles(first_name, last_name, email)")
      .eq("voucher_id", id)
      .order("used_at", { ascending: false })
      .limit(50);

    return NextResponse.json({ success: true, data: { voucher, usage: usage || [] } });
  } catch (error) {
    console.error("GET /api/admin/vouchers/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch voucher" }, { status: 500 });
  }
}
