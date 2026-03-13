import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Tag types that correspond to product tag fields
export type TagType = 'occasion' | 'weather' | 'top_notes' | 'other';

const VALID_TAG_TYPES: TagType[] = ['occasion', 'weather', 'top_notes', 'other'];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';
    const tagType = searchParams.get('type') as TagType | null;

    // Fetch tags from database
    let query = supabase
      .from('tags')
      .select('id, name, type, is_active, created_at, updated_at')
      .order('type', { ascending: true })
      .order('name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (tagType && VALID_TAG_TYPES.includes(tagType)) {
      query = query.eq('type', tagType);
    }

    const { data: tags, error } = await query;

    if (error) throw error;

    // Count products per tag name by scanning all tag arrays
    const { data: productRows } = await supabase
      .from('products')
      .select('occasions_tags, weather_tags, top_notes_tags, other_options_tags')
      .eq('is_archived', false);

    const usageMap: Record<string, number> = {};
    for (const p of productRows || []) {
      for (const field of ['occasions_tags', 'weather_tags', 'top_notes_tags', 'other_options_tags'] as const) {
        for (const tagName of ((p[field] as string[]) || [])) {
          usageMap[tagName] = (usageMap[tagName] || 0) + 1;
        }
      }
    }

    const tagsWithCount = (tags || []).map(tag => ({
      ...tag,
      productCount: usageMap[tag.name] || 0,
    }));

    // Group tags by type for easier consumption
    const groupedTags = VALID_TAG_TYPES.reduce((acc, type) => {
      acc[type] = tagsWithCount.filter(tag => tag.type === type);
      return acc;
    }, {} as Record<TagType, typeof tagsWithCount>);

    return NextResponse.json({
      success: true,
      data: tagsWithCount,
      grouped: groupedTags
    });

  } catch (error) {
    console.error('Tags fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch tags',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  try {
    const body = await request.json();
    const { name, type } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tag name is required'
      }, { status: 400 });
    }

    if (!type || !VALID_TAG_TYPES.includes(type)) {
      return NextResponse.json({
        success: false,
        error: `Tag type must be one of: ${VALID_TAG_TYPES.join(', ')}`
      }, { status: 400 });
    }

    // Check if tag with same name and type already exists
    const { data: existing } = await supabase
      .from('tags')
      .select('id')
      .eq('type', type)
      .ilike('name', name.trim())
      .single();

    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'A tag with this name already exists in this category'
      }, { status: 409 });
    }

    // Create new tag
    const { data: tag, error } = await supabase
      .from('tags')
      .insert({
        name: name.trim(),
        type,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: tag,
      message: 'Tag created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Tag create error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create tag',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  try {
    const body = await request.json();
    const { id, name, type, is_active } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Tag ID is required'
      }, { status: 400 });
    }

    const updateData: { name?: string; type?: TagType; is_active?: boolean; updated_at: string } = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Tag name cannot be empty'
        }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (type !== undefined) {
      if (!VALID_TAG_TYPES.includes(type)) {
        return NextResponse.json({
          success: false,
          error: `Tag type must be one of: ${VALID_TAG_TYPES.join(', ')}`
        }, { status: 400 });
      }
      updateData.type = type;
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    // If updating name or type, check for duplicates
    if (updateData.name || updateData.type) {
      // Get current tag to compare
      const { data: currentTag } = await supabase
        .from('tags')
        .select('name, type')
        .eq('id', id)
        .single();

      if (currentTag) {
        const checkName = updateData.name || currentTag.name;
        const checkType = updateData.type || currentTag.type;

        const { data: existing } = await supabase
          .from('tags')
          .select('id')
          .eq('type', checkType)
          .ilike('name', checkName)
          .neq('id', id)
          .single();

        if (existing) {
          return NextResponse.json({
            success: false,
            error: 'A tag with this name already exists in this category'
          }, { status: 409 });
        }
      }
    }

    const { data: tag, error } = await supabase
      .from('tags')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!tag) {
      return NextResponse.json({
        success: false,
        error: 'Tag not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: tag,
      message: 'Tag updated successfully'
    });

  } catch (error) {
    console.error('Tag update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update tag',
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
        error: 'Tag ID is required'
      }, { status: 400 });
    }

    // Get the tag to know its type and name
    const { data: tag } = await supabase
      .from('tags')
      .select('name, type')
      .eq('id', id)
      .single();

    if (!tag) {
      return NextResponse.json({
        success: false,
        error: 'Tag not found'
      }, { status: 404 });
    }

    // Check if any products are using this tag
    // We need to check the appropriate tag array field based on tag type
    const tagFieldMap: Record<TagType, string> = {
      occasion: 'occasions_tags',
      weather: 'weather_tags',
      top_notes: 'top_notes_tags',
      other: 'other_options_tags'
    };

    const tagField = tagFieldMap[tag.type as TagType];

    // Supabase array contains check
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id')
      .contains(tagField, [tag.name])
      .limit(1);

    if (productError) {
      console.error('Product check error:', productError);
    }

    if (products && products.length > 0) {
      // Soft delete - just deactivate the tag
      const { data: updatedTag, error } = await supabase
        .from('tags')
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
        data: updatedTag,
        message: 'Tag is used by products and was deactivated instead of deleted'
      });
    }

    // Hard delete if no products are using this tag
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Tag deleted successfully'
    });

  } catch (error) {
    console.error('Tag delete error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete tag',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
