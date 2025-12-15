import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { CategoryData } from "../route";

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
        gender_tags,
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
      genderTags: product.gender_tags || [],
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
  const supabase = await createClient();
  try {
    const { id: productId } = await context.params;
    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updateData = { ...body };

    if (updateData.price) {
      updateData.price = Number(updateData.price);
    }
    if (updateData.description) {
      updateData.desc = updateData.description;
      delete updateData.description;
    }

    updateData.updated_at = new Date().toISOString();

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
        gender_tags,
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
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Product not found" },
          { status: 404 }
        );
      }
      throw error;
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
      genderTags: data.gender_tags || [],
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
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update product",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
