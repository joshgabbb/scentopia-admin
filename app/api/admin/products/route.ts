import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logProductCreate, logProductUpdate, logProductDelete } from "@/lib/audit-logger";

export interface CategoryData {
  id: string;
  name: string;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    const categoryFilter = searchParams.get('category') || 'all';
    const perfumeTypeFilter = searchParams.get('perfume_type') || 'all';
    const statusFilter = searchParams.get('status') || 'all';
    const showArchived = searchParams.get('archived') === 'true';
    const limitParam = parseInt(searchParams.get('limit') || '25');
    const limit = [25, 50, 100].includes(limitParam) ? limitParam : 25;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('products')
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
        is_archived,
        archived_at,
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
      `, { count: 'exact' });

    // Filter by archived status
    query = query.eq('is_archived', showArchived);

    // Fix: Format the search query as a single line
    if (search) {
      query = query.or(`name.ilike.%${search}%,desc.ilike.%${search}%`);
    }

    if (categoryFilter && categoryFilter !== 'all') {
      query = query.eq('category_id', categoryFilter);
    }

    if (perfumeTypeFilter && perfumeTypeFilter !== 'all') {
      query = query.eq('perfume_type', perfumeTypeFilter);
    }

    if (statusFilter && statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      query = query.eq('is_active', isActive);
    }

    const sortColumn = sortBy === 'name' ? 'name' : 
                      sortBy === 'price' ? 'price' : 
                      sortBy === 'category' ? 'category.name' :
                      'created_at';
    
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data: products, error, count } = await query;

    for (let i = 0; i < (products?.length || 0); i++) {
      const product = products![i];

      console.log('Product category data:', product.id, JSON.stringify(product.category));
    }

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    const formattedProducts = products?.map(product => {
      try {
        const totalStock = product.stocks ? 
          Object.values(product.stocks as Record<string, number>).reduce((sum, stock) => sum + stock, 0) : 0;

        const availableSizes = product.sizes ? Object.keys(product.sizes as Record<string, number>) : [];

        return {
          id: product.id,
          name: product.name,
          description: product.desc,
          images: product.images || [],
          price: Number(product.price),
          createdAt: product.created_at,
          updatedAt: product.updated_at,
          perfumeType: product.perfume_type,
          isActive: product.is_active,
          isArchived: product.is_archived || false,
          archivedAt: product.archived_at,
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
          availableSizes
        };
      } catch (productError) {
        console.error('Error formatting product:', product.id, productError);
        return null;
      }
    }).filter(Boolean) || [];

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        products: formattedProducts,
        totalCount: count || 0,
        totalPages,
        currentPage: page
      }
    });

  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // authClient for session-aware operations (getUser), adminDb for writes
  const authClient = await createClient();

  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const {
      name,
      desc,
      images,
      price,
      categoryId,
      perfumeType,
      isActive,
      occasionsTags,
      weatherTags,
      topNotesTags,
      otherOptionsTags,
      sizes,
      stocks
    } = body;

    const { data, error } = await supabase
      .from('products')
      .insert({
        name,
        desc: desc,
        images,
        price: Number(price),
        category_id: categoryId,
        perfume_type: perfumeType,
        is_active: isActive,
        occasions_tags: occasionsTags,
        weather_tags: weatherTags,
        top_notes_tags: topNotesTags,
        other_options_tags: otherOptionsTags,
        sizes,
        stocks
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Audit log — fire and forget
    logProductCreate(data.id, name, { name, price, categoryId, perfumeType, isActive }, request);

    // Insert initial stock movements for each size
    if (data && stocks && typeof stocks === 'object') {
      const { data: { user: authUser } } = await authClient.auth.getUser();
      const stockEntries = Object.entries(stocks as Record<string, number>).filter(([, qty]) => qty > 0);
      if (stockEntries.length > 0) {
        await supabase.from('stock_movements').insert(
          stockEntries.map(([size, qty]) => ({
            product_id: data.id,
            size,
            type: 'IN',
            quantity: qty,
            previous_stock: 0,
            new_stock: qty,
            reason: 'Initial Stock',
            remarks: null,
            created_by: authUser?.id || null,
          }))
        );
      }
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Product creation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create product',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updateData = { ...body };

    if (updateData.price) {
      updateData.price = Number(updateData.price);
    }

    updateData.updated_at = new Date().toISOString();

    // Capture old state for audit diff
    const { data: oldProduct } = await supabase
      .from('products')
      .select('name, price, is_active, category_id, perfume_type, stocks')
      .eq('id', productId)
      .single();

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Audit log — fire and forget
    logProductUpdate(
      productId,
      oldProduct?.name ?? productId,
      oldProduct ?? {},
      updateData,
      request
    );

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Product update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update product',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');
    const action = searchParams.get('action') || 'archive'; // 'archive' or 'restore'

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Fetch name for audit label
    const { data: existing } = await supabase
      .from('products')
      .select('name')
      .eq('id', productId)
      .single();

    if (action === 'restore') {
      // Restore archived product
      const { data, error } = await supabase
        .from('products')
        .update({
          is_archived: false,
          archived_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logProductUpdate(productId, existing?.name ?? productId, { is_archived: true }, { is_archived: false }, request);

      return NextResponse.json({
        success: true,
        message: 'Product restored successfully',
        data
      });
    }

    // Archive product (soft delete)
    const { data, error } = await supabase
      .from('products')
      .update({
        is_archived: true,
        is_active: false,
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logProductDelete(productId, existing?.name ?? productId, request);

    // Remove from cart and wishlists when archiving
    await supabase
      .from('cart')
      .delete()
      .eq('product_id', productId);

    await supabase
      .from('wishlists')
      .delete()
      .eq('product_id', productId);

    return NextResponse.json({
      success: true,
      message: 'Product archived successfully',
      data
    });

  } catch (error) {
    console.error('Product archive error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to archive product',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}