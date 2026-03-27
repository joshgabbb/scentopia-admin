// app/api/admin/bundles/route.ts
import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAuditAction } from "@/lib/audit-logger";

// GET — list all published bundles (with product info joined)
export async function GET() {
  const supabase = createAdminClient();
  try {
    const { data, error } = await supabase
      .from("product_bundles")
      .select(`
        *,
        product1:products!product_bundles_product_1_id_fkey(id, name, price, images),
        product2:products!product_bundles_product_2_id_fkey(id, name, price, images)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch bundles" },
      { status: 500 }
    );
  }
}

// POST — publish a new bundle
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  try {
    const body = await request.json();
    const { name, product1Id, product2Id, bundlePrice, originalPrice, discountPercentage, reasoning } = body;

    if (!product1Id || !product2Id || !bundlePrice) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if this pair is already published (either direction)
    const { data: existing } = await supabase
      .from("product_bundles")
      .select("id")
      .or(
        `and(product_1_id.eq.${product1Id},product_2_id.eq.${product2Id}),and(product_1_id.eq.${product2Id},product_2_id.eq.${product1Id})`
      )
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { success: false, error: "This product pair is already published as a bundle" },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("product_bundles")
      .insert({
        name,
        product_1_id: product1Id,
        product_2_id: product2Id,
        bundle_price: bundlePrice,
        original_price: originalPrice,
        discount_percentage: discountPercentage,
        reasoning,
        is_active: true,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    logAuditAction({ action: "CREATE", module: "BUNDLE", entityId: data.id, entityLabel: data.name ?? `Bundle ${data.id.substring(0,8)}`, newValue: { product1Id, product2Id, bundlePrice, discountPercentage } }, request);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to publish bundle" },
      { status: 500 }
    );
  }
}

// PATCH — toggle active / update bundle
export async function PATCH(request: NextRequest) {
  const supabase = createAdminClient();
  try {
    const body = await request.json();
    const { id, isActive } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Bundle ID required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("product_bundles")
      .update({ is_active: isActive })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    logAuditAction({ action: "UPDATE", module: "BUNDLE", entityId: id, entityLabel: data?.name ?? id, newValue: { isActive } }, request);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update bundle" },
      { status: 500 }
    );
  }
}

// DELETE — remove a bundle
export async function DELETE(request: NextRequest) {
  const supabase = createAdminClient();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Bundle ID required" }, { status: 400 });
    }

    const { data: bundleToDelete } = await supabase.from("product_bundles").select("name").eq("id", id).single();
    const { error } = await supabase.from("product_bundles").delete().eq("id", id);
    if (error) throw error;

    logAuditAction({ action: "DELETE", module: "BUNDLE", entityId: id, entityLabel: bundleToDelete?.name ?? id }, request);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete bundle" },
      { status: 500 }
    );
  }
}
