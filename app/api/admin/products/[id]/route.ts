import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { CategoryData } from "../route";
// ✅ ADD THIS IMPORT
import { logProductUpdate, logProductDelete, logInventoryUpdate } from "@/lib/audit-logger";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  try {
    const { id: productId } = await context.params;
    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required" },
        { status: 400 }
      );
    }

    const { data: product, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        desc,
        images,
        price,
        created_at,
        updated_at,
        perfume_type,
        is_active,
        occasions_tags,
        weather_tags,
        top_notes_tags,
        other_options_tags,
        sizes,
        stocks,
        category:category_id(
          id,
          name
        )
      `)
      .eq("id", productId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Product not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    const totalStock = product.stocks
      ? Object.values(product.stocks as Record<string, number>).reduce(
          (sum, stock) => sum + stock,
          0
        )
      : 0;

    const availableSizes = product.sizes
      ? Object.keys(product.sizes as Record<string, number>)
      : [];

    const formattedProduct = {
      id: product.id,
      name: product.name,
      description: product.desc,
      images: product.images || [],
      price: Number(product.price),
      createdAt: product.created_at,
      updatedAt: product.updated_at,
      perfumeType: product.perfume_type,
      isActive: product.is_active,
          category: product.category ? (() => {
            const categoryData = Array.isArray(product.category) 
              ? product.category[0] as CategoryData
              : product.category as CategoryData;
            
            return categoryData ? {
              id: categoryData.id,
              name: categoryData.name
            } : null;
          })() : null,
      occasionsTags: product.occasions_tags || [],
      weatherTags: product.weather_tags || [],
      topNotesTags: product.top_notes_tags || [],
      otherOptionsTags: product.other_options_tags || [],
      sizes: product.sizes || {},
      stocks: product.stocks || {},
      totalStock,
      availableSizes,
    };

    return NextResponse.json({
      success: true,
      data: formattedProduct,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch product details",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { id: productId } = await context.params;
    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updateData = { ...body };

    // Stocks are only allowed to change via /api/admin/stock/in and /api/admin/stock/out
    delete updateData.stocks;

    // ✅ GET OLD PRODUCT DATA BEFORE UPDATING (FOR AUDIT LOG)
    const { data: oldProduct } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (!oldProduct) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    if (updateData.price) {
      updateData.price = Number(updateData.price);
    }
    if (updateData.description) {
      updateData.desc = updateData.description;
      delete updateData.description;
    }

    updateData.updated_at = new Date().toISOString();

    // Auto-sync gender_tags when category changes so the mobile app filters correctly
    if (updateData.category_id) {
      const { data: cat } = await supabase
        .from('category')
        .select('name')
        .eq('id', updateData.category_id)
        .single();
      if (cat?.name) {
        const n = (cat.name as string).toLowerCase();
        if (n.includes('women')) updateData.gender_tags = ['Women'];
        else if (n.includes('men')) updateData.gender_tags = ['Men'];
        else if (n.includes('unisex')) updateData.gender_tags = ['Unisex'];
      }
    }

    // When sizes change, prune stocks to remove keys for deleted sizes.
    // New sizes start at 0 stock — must come through stock-in.
    if (updateData.sizes !== undefined) {
      // Normalize: "30ml", "30 ml", "30ML", "30" all collapse to "30"
      const normKey = (s: string) =>
        s.toLowerCase().replace(/\s+/g, '').replace(/ml$/i, '');

      const newSizeNorms = new Set(
        Object.keys(updateData.sizes as Record<string, number>).map(normKey)
      );
      const existingStocks = ((oldProduct.stocks ?? {}) as Record<string, number>);
      const prunedStocks: Record<string, number> = {};
      for (const [k, qty] of Object.entries(existingStocks)) {
        // Compare normalized; write back with the original stock key unchanged
        if (newSizeNorms.has(normKey(k))) prunedStocks[k] = qty;
      }
      updateData.stocks = prunedStocks;
    }

    console.log("[PATCH /products/:id] Sending update for:", productId, "| Keys:", Object.keys(updateData).join(", "));

    const { data, error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", productId)
      .select(`
        id,
        name,
        desc,
        images,
        price,
        created_at,
        updated_at,
        perfume_type,
        is_active,
        occasions_tags,
        weather_tags,
        top_notes_tags,
        other_options_tags,
        sizes,
        stocks,
        category:category_id(
          id,
          name
        )
      `)
      .single();

    if (error) {
      console.error("[PATCH /products/:id] Supabase update error:", JSON.stringify({ code: error.code, message: error.message, details: error.details, hint: error.hint }, null, 2));
      console.error("[PATCH /products/:id] Payload keys sent:", Object.keys(updateData));
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Product not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    // ✅ LOG AUDIT ACTIONS (AFTER SUCCESSFUL UPDATE)
    try {
      // If stocks changed, log as inventory update
      if (updateData.stocks && JSON.stringify(oldProduct.stocks) !== JSON.stringify(updateData.stocks)) {
        await logInventoryUpdate(
          productId,
          oldProduct.stocks,
          updateData.stocks,
          request
        );
        console.log("✅ Inventory update logged for product:", productId);
      }

      // If other fields changed (name, price, etc.), log as product update
      const otherFieldsChanged = Object.keys(updateData).some(
        key => key !== 'stocks' && key !== 'updated_at' && updateData[key] !== undefined
      );

      if (otherFieldsChanged) {
        await logProductUpdate(
          productId,
          oldProduct?.name ?? productId,
          oldProduct ?? {},
          updateData,
          request
        );
        console.log("✅ Product update logged for product:", productId);
      }
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error("⚠️ Audit logging error:", logError);
    }

    const totalStock = data.stocks
      ? Object.values(data.stocks as Record<string, number>).reduce(
          (sum, stock) => sum + stock,
          0
        )
      : 0;

    const availableSizes = data.sizes
      ? Object.keys(data.sizes as Record<string, number>)
      : [];

    const formattedProduct = {
      id: data.id,
      name: data.name,
      description: data.desc,
      images: data.images || [],
      price: Number(data.price),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      perfumeType: data.perfume_type,
      isActive: data.is_active,
          category: data.category ? (() => {
            const categoryData = Array.isArray(data.category) 
              ? data.category[0] as CategoryData
              : data.category as CategoryData;
            
            return categoryData ? {
              id: categoryData.id,
              name: categoryData.name
            } : null;
          })() : null,
      occasionsTags: data.occasions_tags || [],
      weatherTags: data.weather_tags || [],
      topNotesTags: data.top_notes_tags || [],
      otherOptionsTags: data.other_options_tags || [],
      sizes: data.sizes || {},
      stocks: data.stocks || {},
      totalStock,
      availableSizes,
    };

    return NextResponse.json({
      success: true,
      data: formattedProduct,
    });
  } catch (error) {
    // Supabase PostgrestError is NOT a JS Error instance — extract message manually
    const errMsg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
        ? (error as Record<string, unknown>).message as string ||
          (error as Record<string, unknown>).details as string ||
          JSON.stringify(error)
        : String(error);
    console.error("[PATCH /products/:id] Caught error:", errMsg);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update product",
        details: errMsg,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { id: productId } = await context.params;
    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required" },
        { status: 400 }
      );
    }

    // ✅ GET PRODUCT DATA BEFORE DELETING (FOR AUDIT LOG)
    const { data: product } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    await supabase.from("cart").delete().eq("product_id", productId);
    await supabase.from("wishlists").delete().eq("product_id", productId);
    await supabase
      .from("popular_products")
      .delete()
      .eq("product_id", productId);
    await supabase.from("inventory_logs").delete().eq("product_id", productId);

    let { data: orderItems } = await supabase
      .from("order_items")
      .select("id")
      .eq("product_id", productId);

    if (orderItems && orderItems.length > 0) {
      await supabase
        .from("reviews")
        .delete()
        .in(
          "order_item_id",
          orderItems.map((item) => item.id)
        );

      await supabase.from("order_items").delete().eq("product_id", productId);
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) {
      throw error;
    }

    // ✅ LOG PRODUCT DELETION (AFTER SUCCESSFUL DELETE)
    try {
      await logProductDelete(productId, product?.name ?? productId, request);
      console.log("✅ Product deletion logged for product:", productId);
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error("⚠️ Audit logging error:", logError);
    }

    return NextResponse.json({
      success: true,
      message: "Product and related data deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete product",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}