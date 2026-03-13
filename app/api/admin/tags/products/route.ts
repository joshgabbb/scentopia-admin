import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type TagType = 'occasion' | 'weather' | 'top_notes' | 'other';

const tagFieldMap: Record<TagType, string> = {
  occasion: 'occasions_tags',
  weather: 'weather_tags',
  top_notes: 'top_notes_tags',
  other: 'other_options_tags',
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  try {
    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get('id');

    if (!tagId) {
      return NextResponse.json(
        { success: false, error: 'Tag ID is required' },
        { status: 400 }
      );
    }

    const { data: tag, error: tagError } = await supabase
      .from('tags')
      .select('name, type')
      .eq('id', tagId)
      .single();

    if (tagError || !tag) {
      return NextResponse.json(
        { success: false, error: 'Tag not found' },
        { status: 404 }
      );
    }

    const tagField = tagFieldMap[tag.type as TagType];

    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, is_active, category:category_id(id, name)')
      .contains(tagField, [tag.name])
      .eq('is_archived', false)
      .order('name', { ascending: true });

    if (error) throw error;

    const formatted = (products || []).map(p => {
      const cat = Array.isArray(p.category) ? p.category[0] : p.category;
      return {
        id: p.id,
        name: p.name,
        category: (cat as { name?: string } | null)?.name ?? 'Uncategorized',
        isActive: p.is_active,
      };
    });

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch products',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
