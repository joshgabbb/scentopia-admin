// app/api/admin/reports/inventory-report/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'stock-levels'; // stock-levels | low-stock | movement
    const threshold = parseInt(searchParams.get('threshold') || '10');

    console.log('📊 Inventory Report API called with params:', { type, threshold });

    if (type === 'low-stock') {
      return await getLowStockReport(supabase, threshold);
    } else if (type === 'movement') {
      return await getStockMovementReport(supabase);
    } else {
      return await getStockLevelsReport(supabase);
    }
  } catch (error) {
    console.error('❌ Inventory Report API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch inventory report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Sum all size quantities from the stocks JSONB object: {"30ml": 5, "50ml": 10} → 15
function sumStocks(stocks: unknown): number {
  if (!stocks || typeof stocks !== 'object' || Array.isArray(stocks)) return 0;
  return Object.values(stocks as Record<string, unknown>).reduce(
    (sum, v) => sum + (Number(v) || 0),
    0
  );
}

async function getStockLevelsReport(supabase: any) {
  // Table is `category` (not `categories`) per your schema
  const { data: products, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      price,
      stocks,
      sizes,
      is_active,
      updated_at,
      category!products_category_id_fkey(
        name
      )
    `)
    .eq('is_active', true)
    .eq('is_archived', false)
    .order('name', { ascending: true });

  if (error) throw error;

  const formattedProducts = products?.map((product: any) => {
    // stocks is JSONB: {"30ml": 5, "50ml": 10} — sum all sizes
    const stock = sumStocks(product.stocks);
    let status = 'In Stock';
    if (stock === 0) status = 'Out of Stock';
    else if (stock <= 10) status = 'Low Stock';
    else if (stock <= 25) status = 'Medium Stock';

    return {
      id: product.id,
      name: product.name,
      category: product.category?.name || 'Uncategorized',
      price: Number(product.price) || 0,
      stock,
      status,
      lastUpdated: product.updated_at
        ? new Date(product.updated_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'N/A',
    };
  }) || [];

  const totalStock = formattedProducts.reduce((sum, p) => sum + p.stock, 0);
  const lowStockCount = formattedProducts.filter(p => p.status === 'Low Stock').length;
  const outOfStockCount = formattedProducts.filter(p => p.status === 'Out of Stock').length;

  return NextResponse.json({
    success: true,
    data: {
      products: formattedProducts,
      summary: {
        totalProducts: formattedProducts.length,
        totalStock,
        lowStockCount,
        outOfStockCount,
        inStockCount: formattedProducts.length - lowStockCount - outOfStockCount,
      },
    },
  });
}

async function getLowStockReport(supabase: any, threshold: number) {
  // Fetch all active products — filter by computed total stock in JS
  // because stocks is JSONB and cannot be compared with .lte() directly
  const { data: products, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      price,
      stocks,
      sizes,
      is_active,
      updated_at,
      category!products_category_id_fkey(
        name
      )
    `)
    .eq('is_active', true)
    .eq('is_archived', false)
    .order('name', { ascending: true });

  if (error) throw error;

  const formattedProducts = (products ?? [])
    .map((product: any) => {
      const stock = sumStocks(product.stocks);
      let status = 'Low Stock';
      let priority = 'Medium';

      if (stock === 0) {
        status = 'Out of Stock';
        priority = 'Critical';
      } else if (stock <= 5) {
        priority = 'High';
      }

      return {
        id: product.id,
        name: product.name,
        category: product.category?.name || 'Uncategorized',
        price: Number(product.price) || 0,
        stock,
        status,
        priority,
        lastUpdated: product.updated_at
          ? new Date(product.updated_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'N/A',
      };
    })
    // Apply threshold filter after computing total stock
    .filter(p => p.stock <= threshold)
    .sort((a, b) => a.stock - b.stock);

  const outOfStockCount = formattedProducts.filter(p => p.status === 'Out of Stock').length;
  const criticalCount = formattedProducts.filter(p => p.priority === 'Critical').length;
  const highPriorityCount = formattedProducts.filter(p => p.priority === 'High').length;

  return NextResponse.json({
    success: true,
    data: {
      products: formattedProducts,
      summary: {
        totalLowStock: formattedProducts.length,
        outOfStockCount,
        criticalCount,
        highPriorityCount,
        threshold,
      },
    },
  });
}

async function getStockMovementReport(supabase: any) {
  // Use the dedicated stock_movements table (source of truth)
  const { data: rows, error } = await supabase
    .from('stock_movements')
    .select(`
      id,
      type,
      size,
      quantity,
      previous_stock,
      new_stock,
      reason,
      remarks,
      created_at,
      products!stock_movements_product_id_fkey(
        name
      )
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  const movements = (rows ?? []).map((row: any) => ({
    id: row.id,
    productName: row.products?.name || 'Unknown Product',
    size: row.size,
    type: row.type, // 'IN' | 'OUT'
    previousStock: row.previous_stock,
    newStock: row.new_stock,
    change: row.type === 'IN' ? row.quantity : -row.quantity,
    reason: row.reason || '—',
    remarks: row.remarks || '',
    date: new Date(row.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));

  return NextResponse.json({
    success: true,
    data: {
      movements,
      summary: {
        totalMovements: movements.length,
        totalIn: movements.filter(m => m.type === 'IN').reduce((s, m) => s + m.quantity, 0),
        totalOut: movements.filter(m => m.type === 'OUT').reduce((s, m) => s + Math.abs(m.change), 0),
      },
    },
  });
}
