// app/api/admin/reports/fast-moving/route.ts
// COMPLETE CORRECTED VERSION


import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";


export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "30");


    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateISO = startDate.toISOString();


    console.log("=== FAST-MOVING API ===");
    console.log("Period:", days, "days");
    console.log("Start Date:", startDateISO);


    // Get all products
    const { data: allProducts, error: productsError } = await supabase
      .from('products')
      .select('*');


    if (productsError) {
      console.error("Products error:", productsError);
      return NextResponse.json({
        success: false,
        error: productsError.message
      }, { status: 500 });
    }


    console.log("Total products:", allProducts?.length || 0);


    if (!allProducts || allProducts.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          products: [],
          summary: {
            totalUnitsSold: 0,
            totalRevenue: 0,
            needsRestockCount: 0,
            outOfStockCount: 0
          }
        }
      });
    }


    // Get order items with date filter
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select(`
        *,
        orders (
          id,
          order_status,
          created_at
        )
      `)
      .gte('created_at', startDateISO);


    console.log("Order items found:", orderItems?.length || 0);


    if (orderItemsError) {
      console.error("Order items error:", orderItemsError);
    }


    // Calculate metrics for each product
    const productsWithMetrics = allProducts.map(product => {
      // Find all order items for this product with valid status
      const productOrders = (orderItems || []).filter((item: any) => {
        const matchesProduct = item.product_id === product.id;
        const validStatuses = ['Delivered', 'Confirmed', 'Processing', 'Pending', 'Shipped'];
        const hasValidStatus = validStatuses.includes(item.orders?.order_status);
        return matchesProduct && hasValidStatus;
      });


      const totalQuantitySold = productOrders.reduce(
        (sum: number, item: any) => sum + (item.quantity || 0),
        0
      );


      const totalRevenue = productOrders.reduce(
        (sum: number, item: any) => sum + (item.item_amount || 0),
        0
      );


      const orderCount = new Set(
        productOrders.map((item: any) => item.orders?.id).filter(Boolean)
      ).size;


      // Calculate total stock from stocks object
      const stocksObj = product.stocks || {};
      const totalStock = Object.values(stocksObj).reduce(
        (sum: number, qty: any) => sum + (qty || 0),
        0
      );


      const velocity = totalQuantitySold / days;
      const daysUntilStockout = velocity > 0 ? Math.floor(totalStock / velocity) : 0;


      // CATEGORIZATION LOGIC:
      // Fast-Moving = sells 1 or more units per day (30+ units in 30 days)
      // Very Fast = sells 3 or more units per day (90+ units in 30 days)


      let status = "fast";
      let needsRestock = false;


      if (velocity >= 3.0) {
        status = "very_fast";  // Sells 90+ units per month
      } else if (velocity >= 1.0) {
        status = "fast";       // Sells 30-89 units per month
      }


      // Stock status check
      if (totalStock === 0) {
        needsRestock = true;
      } else if (totalStock < 10 || (daysUntilStockout > 0 && daysUntilStockout < 7)) {
        needsRestock = true;
      }


      // Get first image from images array
      const productImage = Array.isArray(product.images) && product.images.length > 0
        ? product.images[0]
        : null;


      return {
        productId: product.id,
        productName: product.name || 'Unknown Product',
        productPrice: product.price || 0,
        productImage,
        totalQuantitySold,
        totalRevenue,
        orderCount,
        currentStock: totalStock,
        velocity: parseFloat(velocity.toFixed(2)),
        daysUntilStockout,
        needsRestock,
        status
      };
    });


    // FAST-MOVING FILTER:
    // Only show products with velocity >= 1.0 (30+ units sold in 30 days)
    // This means the product sells at least 1 unit per day on average
    const fastMovingProducts = productsWithMetrics
      .filter(product => product.velocity >= 1.0)
      .sort((a, b) => b.velocity - a.velocity);


    console.log("Fast-moving products:", fastMovingProducts.length);
    if (fastMovingProducts.length > 0) {
      console.log("Top product:", fastMovingProducts[0].productName,
                  "- Velocity:", fastMovingProducts[0].velocity);
    }


    const summary = {
      totalUnitsSold: fastMovingProducts.reduce((sum, p) => sum + p.totalQuantitySold, 0),
      totalRevenue: fastMovingProducts.reduce((sum, p) => sum + p.totalRevenue, 0),
      needsRestockCount: fastMovingProducts.filter(p => p.needsRestock).length,
      outOfStockCount: fastMovingProducts.filter(p => p.status === "out_of_stock").length
    };


    console.log("Summary:", summary);


    return NextResponse.json({
      success: true,
      data: {
        products: fastMovingProducts,
        summary
      }
    });


  } catch (error) {
    console.error("Fast-moving API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch fast-moving items",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

