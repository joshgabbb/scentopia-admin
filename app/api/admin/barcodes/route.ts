import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAuditAction } from "@/lib/audit-logger";

/** GET /api/admin/barcodes
 * Query params:
 *   product_id  (optional) – filter by product
 *   page        (default 1)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("product_id") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 50;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("product_barcodes")
      .select(
        `
        id,
        product_id,
        size,
        barcode_value,
        is_active,
        created_by,
        created_at,
        updated_at,
        products (
          id,
          name,
          price,
          stocks
        )
      `,
        { count: "exact" }
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (productId) {
      query = query.eq("product_id", productId);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        barcodes: data ?? [],
        totalCount: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
        currentPage: page,
      },
    });
  } catch (error) {
    console.error("Barcodes GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch barcodes",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/** POST /api/admin/barcodes
 * Body: { product_id, size }
 * Calls the same Supabase RPC used by the mobile app: generate_ean13_barcode
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { product_id, size } = body;

    if (!product_id || !size) {
      return NextResponse.json(
        { success: false, error: "product_id and size are required" },
        { status: 400 }
      );
    }

    // Delegate to the same RPC the mobile app uses
    const response = await supabase.rpc("generate_ean13_barcode", {
      p_product_id: product_id,
      p_size: size,
    });

    if (response.error) throw response.error;

    const barcode = response.data as any;
    logAuditAction({ action: "CREATE", module: "BARCODE", entityId: barcode?.id ?? product_id, entityLabel: `${barcode?.products?.name ?? product_id} (${size})`, newValue: { product_id, size, barcode_value: barcode?.barcode_value } }, request);

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Barcode generate error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate barcode",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/** DELETE /api/admin/barcodes?id=<barcode_id>
 * Deactivates (soft-deletes) a barcode
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Barcode id is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("product_barcodes")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    logAuditAction({ action: "DELETE", module: "BARCODE", entityId: id, metadata: { barcode_id: id } }, request);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Barcode delete error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to deactivate barcode",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
