import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';

    // Fetch sizes from database
    let query = supabase
      .from('sizes')
      .select('id, name, is_active, created_at, updated_at')
      .order('name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: sizes, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: sizes || []
    });

  } catch (error) {
    console.error('Sizes fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch sizes',
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
        error: 'Size name is required'
      }, { status: 400 });
    }

    // Check if size with same name already exists
    const { data: existing } = await supabase
      .from('sizes')
      .select('id')
      .ilike('name', name.trim())
      .single();

    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'A size with this name already exists'
      }, { status: 409 });
    }

    // Create new size
    const { data: size, error } = await supabase
      .from('sizes')
      .insert({
        name: name.trim(),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: size,
      message: 'Size created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Size create error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create size',
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
        error: 'Size ID is required'
      }, { status: 400 });
    }

    const updateData: { name?: string; is_active?: boolean; updated_at: string } = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Size name cannot be empty'
        }, { status: 400 });
      }

      // Check if another size with same name exists
      const { data: existing } = await supabase
        .from('sizes')
        .select('id')
        .ilike('name', name.trim())
        .neq('id', id)
        .single();

      if (existing) {
        return NextResponse.json({
          success: false,
          error: 'A size with this name already exists'
        }, { status: 409 });
      }

      updateData.name = name.trim();
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    const { data: size, error } = await supabase
      .from('sizes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!size) {
      return NextResponse.json({
        success: false,
        error: 'Size not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: size,
      message: 'Size updated successfully'
    });

  } catch (error) {
    console.error('Size update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update size',
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
        error: 'Size ID is required'
      }, { status: 400 });
    }

    // Check if any products are using this size
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('size_id', id)
      .limit(1);

    if (productError) throw productError;

    if (products && products.length > 0) {
      // Soft delete - just deactivate the size
      const { data: size, error } = await supabase
        .from('sizes')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: size,
        message: 'Size has products assigned and was deactivated instead of deleted'
      });
    }

    // Hard delete if no products are using this size
    const { error } = await supabase
      .from('sizes')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Size deleted successfully'
    });

  } catch (error) {
    console.error('Size delete error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete size',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
