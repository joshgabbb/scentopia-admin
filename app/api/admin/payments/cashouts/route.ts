// app/api/admin/payments/cashouts/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAuditAction } from "@/lib/audit-logger";

export async function GET() {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("payment_cashouts")
      .select("*")
      .order("cashed_out_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Cashouts GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch cashouts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { method, amount, note, cashed_out_at } = body;

    if (!method || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: "method and a positive amount are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("payment_cashouts")
      .insert({
        method,
        amount: Number(amount),
        note: note || null,
        cashed_out_at: cashed_out_at || new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    logAuditAction({
      action: "CREATE",
      module: "CASHOUT",
      entityId: data.id,
      entityLabel: `₱${Number(amount).toLocaleString()} cashout via ${method}`,
      newValue: { method, amount: Number(amount), note: note || null },
    }, request);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Cashouts POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record cashout" },
      { status: 500 }
    );
  }
}
