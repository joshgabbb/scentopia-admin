import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  try {
    // Fetch categories from database
    const { data: categories, error } = await supabase
      .from('category')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: categories || []
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