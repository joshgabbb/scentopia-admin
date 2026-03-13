import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('id');

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: 'Category ID is required' },
        { status: 400 }
      );
    }

    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, is_active, category:category_id(id, name)')
      .eq('category_id', categoryId)
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
