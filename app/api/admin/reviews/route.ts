import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { logAuditAction } from "@/lib/audit-logger";

const ITEMS_PER_PAGE = 20;

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const search = searchParams.get("search") || "";

    // Build base query
    let query = supabase
      .from('reviews')
      .select('id, user_id, order_item_id, rating, description, is_anon, created_at, admin_response, responded_at', { count: 'exact' });

    if (search) {
      query = query.ilike('description', `%${search}%`);
    }

    const { count } = await query;
    const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE);

    const { data: reviewRows, error } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

    if (error) throw error;
    if (!reviewRows || reviewRows.length === 0) {
      return NextResponse.json({ success: true, data: { reviews: [], totalPages: 0, currentPage: page } });
    }

    // Batch fetch order_items to get product_ids
    const orderItemIds = reviewRows.map(r => r.order_item_id).filter(Boolean);
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, product_id')
      .in('id', orderItemIds);

    // Batch fetch products
    const productIds = [...new Set((orderItems || []).map(oi => oi.product_id).filter(Boolean))];
    const { data: products } = productIds.length > 0
      ? await supabase.from('products').select('id, name').in('id', productIds)
      : { data: [] };

    // Batch fetch profiles for non-anon reviews
    const userIds = [...new Set(reviewRows.filter(r => !r.is_anon && r.user_id).map(r => r.user_id))];
    const { data: profiles } = userIds.length > 0
      ? await supabase.from('profiles').select('id, first_name, last_name').in('id', userIds)
      : { data: [] };

    // Build lookup maps
    const orderItemMap = new Map((orderItems || []).map(oi => [oi.id, oi]));
    const productMap = new Map((products || []).map(p => [p.id, p]));
    const profileMap = new Map(
      (profiles || []).map((p: { id: string; first_name: string | null; last_name: string | null }) => [
        p.id,
        [p.first_name, p.last_name].filter(Boolean).join(" ") || "Customer",
      ])
    );

    const reviews = reviewRows.map(r => {
      const orderItem = orderItemMap.get(r.order_item_id);
      const product = orderItem ? productMap.get(orderItem.product_id) : null;
      const customerName: string = r.is_anon ? "Anonymous" : ((profileMap.get(r.user_id) as string) ?? "Customer");

      return {
        id: r.id,
        customerName,
        productName: product?.name || "Unknown Product",
        rating: r.rating,
        description: r.description,
        isAnon: r.is_anon,
        createdAt: r.created_at,
        adminResponse: r.admin_response ?? null,
        respondedAt: r.responded_at ?? null,
      };
    });

    return NextResponse.json({ success: true, data: { reviews, totalPages, currentPage: page } });

  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch reviews", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { id, adminResponse } = await request.json();

    if (!id || !adminResponse?.trim()) {
      return NextResponse.json({ success: false, error: "id and adminResponse are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('reviews')
      .update({ admin_response: adminResponse.trim(), responded_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logAuditAction({
      action: "UPDATE",
      module: "FEEDBACK",
      entityId: id,
      entityLabel: `Review #${id.substring(0, 8).toUpperCase()}`,
      newValue: { admin_response: adminResponse.trim() },
    }, request);

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error("Error updating review:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update review", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
