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

async function getStockLevelsReport(supabase: any) {
  const { data: products, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      price,
      stocks,
      is_active,
      updated_at,
      categories!products_category_id_fkey(
        name
      )
    `)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;

  const formattedProducts = products?.map((product: any) => {
    const stock = Number(product.stocks) || 0;
    let status = 'In Stock';
    if (stock === 0) status = 'Out of Stock';
    else if (stock <= 10) status = 'Low Stock';
    else if (stock <= 25) status = 'Medium Stock';

    return {
      id: product.id,
      name: product.name,
      category: product.categories?.name || 'Uncategorized',
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
  const { data: products, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      price,
      stocks,
      is_active,
      updated_at,
      categories!products_category_id_fkey(
        name
      )
    `)
    .eq('is_active', true)
    .lte('stocks', threshold)
    .order('stocks', { ascending: true });

  if (error) throw error;

  const formattedProducts = products?.map((product: any) => {
    const stock = Number(product.stocks) || 0;
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
      category: product.categories?.name || 'Uncategorized',
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
  }) || [];

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
  // Try to get audit logs for stock movements
  const { data: auditLogs, error: auditError } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('action', 'stock_update')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!auditError && auditLogs && auditLogs.length > 0) {
    const movements = auditLogs.map((log: any) => ({
      id: log.id,
      productName: log.metadata?.product_name || 'Unknown Product',
      previousStock: log.metadata?.previous_stock || 0,
      newStock: log.metadata?.new_stock || 0,
      change: (log.metadata?.new_stock || 0) - (log.metadata?.previous_stock || 0),
      reason: log.metadata?.reason || 'Stock update',
      date: new Date(log.created_at).toLocaleDateString('en-US', {
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
        },
      },
    });
  }

  // Fallback: Calculate movement from order_items (sold products)
  const { data: recentOrderItems, error } = await supabase
    .from('order_items')
    .select(`
      id,
      quantity,
      created_at,
      products!order_items_product_id_fkey(
        name
      ),
      orders!order_items_order_id_fkey(
        order_status
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  const movements = recentOrderItems
    ?.filter((item: any) => item.orders?.order_status !== 'Cancelled')
    .map((item: any) => ({
      id: item.id,
      productName: item.products?.name || 'Unknown Product',
      previousStock: 'N/A',
      newStock: 'N/A',
      change: -(Number(item.quantity) || 0), // Negative because stock decreased
      reason: 'Order placed',
      date: new Date(item.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    })) || [];

  return NextResponse.json({
    success: true,
    data: {
      movements,
      summary: {
        totalMovements: movements.length,
        note: 'Stock movement derived from orders (audit logs not available)',
      },
    },
  });
}
