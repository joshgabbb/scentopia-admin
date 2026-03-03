import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const productId = searchParams.get("productId") || "";
    const typeFilter = searchParams.get("type") || "all";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const limit = 25;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("stock_movements")
      .select(
        `
        id,
        product_id,
        size,
        type,
        quantity,
        previous_stock,
        new_stock,
        reason,
        remarks,
        created_by,
        created_at,
        products!inner(
          name,
          images
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (productId) {
      query = query.eq("product_id", productId);
    }

    if (typeFilter === "IN" || typeFilter === "OUT") {
      query = query.eq("type", typeFilter);
    }

    if (dateFrom) {
      query = query.gte("created_at", new Date(dateFrom).toISOString());
    }

    if (dateTo) {
      // Include the full end day
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt("created_at", endDate.toISOString());
    }

    const { data: movements, error, count } = await query;

    if (error) throw error;

    // Fetch creator names separately for non-null created_by values
    const creatorIds = [...new Set(
      movements
        ?.filter(m => m.created_by)
        .map(m => m.created_by as string) || []
    )];

    let profilesMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", creatorIds);

      if (profiles) {
        profilesMap = Object.fromEntries(
          profiles.map(p => [
            p.id,
            [p.first_name, p.last_name].filter(Boolean).join(" ") || "Admin",
          ])
        );
      }
    }

    const formatted = movements?.map(m => {
      const product = Array.isArray(m.products) ? m.products[0] : m.products;
      return {
        id: m.id,
        productId: m.product_id,
        productName: (product as { name: string; images: string[] })?.name || "Unknown Product",
        productImage: (product as { name: string; images: string[] })?.images?.[0] || null,
        size: m.size,
        type: m.type as "IN" | "OUT",
        quantity: m.quantity,
        previousStock: m.previous_stock,
        newStock: m.new_stock,
        reason: m.reason,
        remarks: m.remarks,
        createdBy: m.created_by,
        createdByName: m.created_by ? (profilesMap[m.created_by] || "Admin") : null,
        createdAt: m.created_at,
      };
    }) || [];

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        movements: formatted,
        totalCount: count || 0,
        totalPages,
        currentPage: page,
      },
    });
  } catch (error) {
    console.error("Stock history error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch stock history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
