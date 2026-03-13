import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logCategoryCreate, logCategoryUpdate, logCategoryDelete } from "@/lib/audit-logger";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';

    // Fetch categories from database
    let query = supabase
      .from('category')
      .select('id, name, is_active, created_at, updated_at')
      .order('name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: categories, error } = await query;

    if (error) throw error;

    // Count products per category
    const { data: productRows } = await supabase
      .from('products')
      .select('category_id')
      .eq('is_archived', false);

    const countMap: Record<string, number> = {};
    for (const p of productRows || []) {
      if (p.category_id) {
        countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
      }
    }

    const categoriesWithCount = (categories || []).map(cat => ({
      ...cat,
      productCount: countMap[cat.id] || 0,
    }));

    return NextResponse.json({
      success: true,
      data: categoriesWithCount
    });

  } catch (error) {
    console.error('Categories fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch categories',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Category name is required'
      }, { status: 400 });
    }

    // Check if category with same name already exists
    const { data: existing } = await supabase
      .from('category')
      .select('id')
      .ilike('name', name.trim())
      .single();

    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'A category with this name already exists'
      }, { status: 409 });
    }

    // Create new category (let DB handle created_at/updated_at defaults)
    const { data: category, error } = await supabase
      .from('category')
      .insert({ name: name.trim(), is_active: true })
      .select()
      .single();

    if (error) throw error;

    logCategoryCreate(category.id, category.name, request);

    return NextResponse.json({
      success: true,
      data: category,
      message: 'Category created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Category create error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create category',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  try {
    const body = await request.json();
    const { id, name, is_active } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Category ID is required'
      }, { status: 400 });
    }

    const updateData: { name?: string; is_active?: boolean; updated_at?: string } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Category name cannot be empty'
        }, { status: 400 });
      }

      // Check if another category with same name exists
      const { data: existing } = await supabase
        .from('category')
        .select('id')
        .ilike('name', name.trim())
        .neq('id', id)
        .single();

      if (existing) {
        return NextResponse.json({
          success: false,
          error: 'A category with this name already exists'
        }, { status: 409 });
      }

      updateData.name = name.trim();
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    // Fetch current state before update (needed for audit diff and to confirm existence)
    const { data: currentCategory, error: fetchError } = await supabase
      .from('category')
      .select('id, name, is_active')
      .eq('id', id)
      .single();

    if (fetchError || !currentCategory) {
      return NextResponse.json({
        success: false,
        error: 'Category not found'
      }, { status: 404 });
    }

    updateData.updated_at = new Date().toISOString();

    // Use .select() without .single() — avoids PGRST116 when RLS filters the result
    const { data: rows, error } = await supabase
      .from('category')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase category update error:', error);
      throw error;
    }

    const category = rows?.[0] ?? null;

    if (!category) {
      return NextResponse.json({
        success: false,
        error: 'Category not found or update was blocked'
      }, { status: 404 });
    }

    if (name !== undefined) {
      logCategoryUpdate(id, currentCategory.name, name.trim(), request);
    }

    return NextResponse.json({
      success: true,
      data: category,
      message: 'Category updated successfully'
    });

  } catch (error) {
    console.error('Category update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update category',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Category ID is required'
      }, { status: 400 });
    }

    // Check if any products are using this category
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('category_id', id)
      .limit(1);

    if (productError) throw productError;

    // Fetch name for audit label before deleting
    const { data: catRecord } = await supabase.from('category').select('name').eq('id', id).single();

    if (products && products.length > 0) {
      // Soft delete - just deactivate the category
      const { data: rows, error } = await supabase
        .from('category')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select();

      if (error) throw error;
      const category = rows?.[0] ?? null;

      logCategoryDelete(id, catRecord?.name ?? id, request);

      return NextResponse.json({
        success: true,
        data: category,
        message: 'Category has products assigned and was deactivated instead of deleted'
      });
    }

    // Hard delete if no products are using this category
    const { error } = await supabase
      .from('category')
      .delete()
      .eq('id', id);

    if (error) throw error;

    logCategoryDelete(id, catRecord?.name ?? id, request);

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Category delete error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete category',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}