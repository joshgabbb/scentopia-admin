// app/api/admin/payments/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const LIMIT = 25;
const PAID_STATUSES = ["paid", "completed", "successful"];

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const method = searchParams.get("method") || "all";
    const status = searchParams.get("status") || "all";
    const dateFrom = searchParams.get("date_from") || "";
    const dateTo = searchParams.get("date_to") || "";
    const offset = (page - 1) * LIMIT;

    // ── Summary query (all payments, no pagination) ─────────────────────
    let summaryQuery = supabase
      .from("payments")
      .select("id, payment_method, amount, status");

    const { data: allPayments, error: summaryError } = await summaryQuery;

    if (summaryError) throw summaryError;

    // Compute summary totals from paid/completed payments
    const paid = allPayments?.filter((p) =>
      PAID_STATUSES.includes((p.status || "").toLowerCase())
    ) || [];

    const byMethod: Record<string, number> = { gcash: 0, paypal: 0, wallet: 0, paymaya: 0, card: 0 };
    let totalCollected = 0;

    paid.forEach((p) => {
      const m = (p.payment_method || "").toLowerCase();
      const amt = Number(p.amount) || 0;
      totalCollected += amt;
      if (m in byMethod) byMethod[m] += amt;
    });

    const onlineCollected = byMethod.gcash + byMethod.paypal + byMethod.paymaya + byMethod.card;

    // Cashout total
    const { data: cashouts } = await supabase
      .from("payment_cashouts")
      .select("amount");

    const totalCashedOut = cashouts?.reduce((s, c) => s + Number(c.amount), 0) || 0;
    const uncashedOnline = Math.max(0, onlineCollected - totalCashedOut);

    // ── Paginated list query ─────────────────────────────────────────────
    let query = supabase
      .from("payments")
      .select(
        `
        id,
        payment_method,
        amount,
        status,
        currency,
        created_at,
        order_id,
        orders!payments_order_id_fkey(
          id,
          order_status,
          profiles!orders_user_id_fkey(
            first_name,
            last_name,
            email
          )
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (method && method !== "all") {
      query = query.eq("payment_method", method);
    }
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (dateFrom) {
      query = query.gte("created_at", dateFrom);
    }
    if (dateTo) {
      query = query.lte("created_at", dateTo + "T23:59:59");
    }

    query = query.range(offset, offset + LIMIT - 1);

    const { data: payments, error, count } = await query;

    if (error) throw error;

    const formattedPayments = payments?.map((p) => {
      const order = Array.isArray(p.orders) ? p.orders[0] : p.orders;
      const profile = order
        ? Array.isArray((order as any).profiles)
          ? (order as any).profiles[0]
          : (order as any).profiles
        : null;
      const customerName = profile
        ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown"
        : "Unknown";
      const customerEmail = profile?.email || "";
      const orderId = (order as any)?.id || p.order_id || "";
      const orderStatus = (order as any)?.order_status || "";

      return {
        id: p.id,
        paymentMethod: p.payment_method,
        amount: Number(p.amount),
        status: p.status,
        currency: p.currency || "PHP",
        createdAt: p.created_at,
        orderId,
        orderNumber: orderId ? `#${orderId.substring(0, 8).toUpperCase()}` : "—",
        orderStatus,
        customerName,
        customerEmail,
      };
    }) || [];

    const totalPages = Math.max(1, Math.ceil((count || 0) / LIMIT));

    return NextResponse.json({
      success: true,
      data: {
        payments: formattedPayments,
        summary: {
          totalCollected,
          byMethod,
          onlineCollected,
          totalCashedOut,
          uncashedOnline,
        },
        totalCount: count || 0,
        totalPages,
        currentPage: page,
      },
    });
  } catch (error) {
    console.error("Payments API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch payments",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
