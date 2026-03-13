import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/sizes/products?name=30ml
// Returns products that have a given size name as a key in their sizes JSONB
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  try {
    const { searchParams } = new URL(request.url);
    const sizeName = searchParams.get('name');

    if (!sizeName) {
      return NextResponse.json(
        { success: false, error: 'Size name is required' },
        { status: 400 }
      );
    }

    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        is_active,
        sizes,
        category:category_id(id, name)
      `)
      .not('sizes', 'is', null)
      .eq('is_archived', false);

    if (error) throw error;

    // Normalize size keys: "50ml", "50 ml", "50" all match each other
    const normKey = (s: string) =>
      s.toLowerCase().replace(/\s+/g, '').replace(/ml$/i, '');
    const targetNorm = normKey(sizeName);

    const using = (products || []).filter(p =>
      Object.keys(p.sizes || {}).some(k => normKey(k) === targetNorm)
    );

    return NextResponse.json({
      success: true,
      data: using.map(p => {
        const cat = Array.isArray(p.category) ? p.category[0] : p.category;
        return {
          id: p.id,
          name: p.name,
          isActive: p.is_active,
          category: (cat as any)?.name || 'N/A',
        };
      }),
    });
  } catch (error) {
    console.error('Size products fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products for size' },
      { status: 500 }
    );
  }
}
