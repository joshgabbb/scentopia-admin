import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** GET /api/admin/barcodes/scans
 * Query params:
 *   scan_type   "stock_in" | "sale" | "" (all)
 *   product_id  (optional)
 *   page        (default 1)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { searchParams } = new URL(request.url);
    const scanType = searchParams.get("scan_type") || "";
    const productId = searchParams.get("product_id") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 30;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("barcode_scans")
      .select(
        `
        id,
        barcode_id,
        product_id,
        size,
        scan_type,
        quantity,
        scanned_by,
        scanned_at,
        notes,
        product_name
      `,
        { count: "exact" }
      )
      .order("scanned_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (scanType) query = query.eq("scan_type", scanType);
    if (productId) query = query.eq("product_id", productId);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        scans: data ?? [],
        totalCount: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
        currentPage: page,
      },
    });
  } catch (error) {
    console.error("Scans GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch scan history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
