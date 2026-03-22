// app/api/admin/refunds/route.ts
import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/refunds?status=Pending&order_id=xxx
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const orderId = searchParams.get("order_id");

  try {
    let query = supabase
      .from("refunds")
      .select(
        `id, order_id, user_id, reason, description, image_url, amount, status, admin_note, created_at, updated_at, expires_at,
         orders!refunds_order_id_fkey(id, amount, order_status, email, contact_number)`
      )
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (orderId) query = query.eq("order_id", orderId);

    const { data, error } = await query;
    if (error) throw error;

    const refunds = data || [];

    // Fetch profiles separately (user_id → auth.users, not directly joinable)
    const userIds = [...new Set(refunds.map((r: Record<string, unknown>) => r.user_id as string))];
    let profileMap: Record<string, { full_name: string | null; email: string | null }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);

      if (profiles) {
        profileMap = Object.fromEntries(
          profiles.map((p: { id: string; first_name: string | null; last_name: string | null; email: string | null }) => [
            p.id,
            {
              full_name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Customer",
              email: p.email,
            },
          ])
        );
      }
    }

    const now = new Date();
    const enriched = refunds.map((r: Record<string, unknown>) => {
      const expiresAt = r.expires_at ? new Date(r.expires_at as string) : null;
      return {
        ...r,
        profiles: profileMap[r.user_id as string] ?? null,
        is_expired: expiresAt ? now > expiresAt : false,
        days_until_expiry: expiresAt
          ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error("❌ Refunds GET error:", error);
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/refunds  — approve or decline a refund
export async function PATCH(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { refundId, action, adminNote } = body as {
      refundId: string;
      action: "approve" | "decline";
      adminNote?: string;
    };

    if (!refundId || !action) {
      return NextResponse.json(
        { success: false, error: "refundId and action are required" },
        { status: 400 }
      );
    }

    // Fetch refund to get amount and user_id
    const { data: refund, error: fetchErr } = await supabase
      .from("refunds")
      .select("id, order_id, user_id, amount, status")
      .eq("id", refundId)
      .single();

    if (fetchErr || !refund) {
      return NextResponse.json(
        { success: false, error: "Refund not found" },
        { status: 404 }
      );
    }

    if (refund.status !== "Pending") {
      return NextResponse.json(
        { success: false, error: "Refund has already been processed" },
        { status: 400 }
      );
    }

    const newStatus = action === "approve" ? "Approved" : "Declined";

    // Update refund status
    const { error: updateErr } = await supabase
      .from("refunds")
      .update({ status: newStatus, admin_note: adminNote ?? null })
      .eq("id", refundId);

    if (updateErr) throw updateErr;

    // If approved, credit the user's wallet via wallet_transactions
    if (action === "approve") {
      // Get user's wallet
      const { data: wallet, error: walletErr } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", refund.user_id)
        .single();

      if (walletErr || !wallet) {
        console.error("❌ Wallet not found for user:", refund.user_id);
        return NextResponse.json(
          { success: false, error: "User wallet not found" },
          { status: 400 }
        );
      }

      // Insert credit transaction (DB trigger updates wallet balance)
      const { error: txErr } = await supabase.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        type: "credit",
        amount: refund.amount,
        description: `Refund approved for Order #${String(refund.order_id).substring(0, 8).toUpperCase()}`,
        status: "successful",
      });

      if (txErr) throw txErr;
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error("❌ Refunds PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process refund" },
      { status: 500 }
    );
  }
}
