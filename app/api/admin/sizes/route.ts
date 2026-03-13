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

    // Count products using each size.
    // Products may store sizes as "50ml", "50 ml", or bare "50" — normalize both sides.
    const normKey = (s: string) =>
      s.toLowerCase().replace(/\s+/g, '').replace(/ml$/i, '');

    const { data: products } = await supabase
      .from('products')
      .select('sizes')
      .eq('is_archived', false);

    const usageMap: Record<string, number> = {};
    for (const product of products || []) {
      for (const key of Object.keys(product.sizes || {})) {
        const n = normKey(key);
        usageMap[n] = (usageMap[n] || 0) + 1;
      }
    }

    const sizesWithCount = (sizes || []).map(size => ({
      ...size,
      productCount: usageMap[normKey(size.name)] || 0,
    }));

    // Find size keys used in products that have no matching entry in the sizes table
    const allProductKeys = new Set<string>();
    for (const product of products || []) {
      for (const key of Object.keys(product.sizes || {})) {
        allProductKeys.add(key);
      }
    }
    const knownNorms = new Set((sizes || []).map(s => normKey(s.name)));
    const orphanKeys = [...allProductKeys].filter(k => !knownNorms.has(normKey(k)));

    return NextResponse.json({
      success: true,
      data: sizesWithCount,
      orphanKeys,
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

    // Look up the size name so we can check JSONB keys (sizes are stored as JSONB, not a FK)
    const { data: sizeRecord, error: sizeRecordError } = await supabase
      .from('sizes')
      .select('name')
      .eq('id', id)
      .single();

    if (sizeRecordError || !sizeRecord) {
      return NextResponse.json(
        { success: false, error: 'Size not found' },
        { status: 404 }
      );
    }

    // Check if any non-archived products use this size key (normalized comparison)
    const normKey = (s: string) =>
      s.toLowerCase().replace(/\s+/g, '').replace(/ml$/i, '');
    const targetNorm = normKey(sizeRecord.name);

    const { data: allProducts } = await supabase
      .from('products')
      .select('sizes')
      .eq('is_archived', false);

    const isInUse = (allProducts || []).some(p =>
      Object.keys(p.sizes || {}).some(k => normKey(k) === targetNorm)
    );

    if (isInUse) {
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
