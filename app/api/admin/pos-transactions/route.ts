// app/api/admin/pos-transactions/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const dateFrom = searchParams.get("date_from") || "";
    const dateTo = searchParams.get("date_to") || "";
    const limit = 25;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("pos_transactions")
      .select(
        `
        id,
        total_amount,
        created_at,
        pos_transaction_items!pos_transaction_items_transaction_id_fkey(
          product_name,
          quantity,
          unit_price,
          subtotal
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

    query = query.range(offset, offset + limit - 1);

    const { data: transactions, error, count } = await query;

    if (error) throw error;

    const formatted = (transactions || []).map((tx: any) => ({
      id: tx.id,
      transactionNumber: `#${String(tx.id).substring(0, 8).toUpperCase()}`,
      totalAmount: Number(tx.total_amount),
      createdAt: tx.created_at,
      items: (tx.pos_transaction_items || []).map((item: any) => ({
        productName: item.product_name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        subtotal: Number(item.subtotal),
      })),
      itemCount: (tx.pos_transaction_items || []).reduce(
        (sum: number, item: any) => sum + (Number(item.quantity) || 0),
        0
      ),
    }));

    return NextResponse.json({
      success: true,
      data: {
        transactions: formatted,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
      },
    });
  } catch (error) {
    console.error("❌ POS transactions API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch POS transactions" },
      { status: 500 }
    );
  }
}
