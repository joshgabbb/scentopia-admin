// app/api/admin/reports/slow-moving/route.ts
// COMPLETE CORRECTED VERSION


import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";


export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "60");


    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateISO = startDate.toISOString();


    console.log("=== SLOW-MOVING API ===");
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
            noSalesCount: 0,
            verySlowCount: 0,
            slowCount: 0,
            totalStockValue: 0
          }
        }
      });
    }


    // Get order items
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


      // Calculate total stock from stocks object
      const stocksObj = product.stocks || {};
      const totalStock = Object.values(stocksObj).reduce(
        (sum: number, qty: any) => sum + (qty || 0),
        0
      );


      const velocity = totalQuantitySold / days;
      const daysOfInventory = velocity > 0 ? Math.floor(totalStock / velocity) : 999;


      const productAge = Math.floor(
        (Date.now() - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );


      // CATEGORIZATION LOGIC (based on 60-day period):
      // ================================================
      // No Sales    = 0 bottles sold
      // Very Slow   = less than 6 bottles in 60 days (velocity < 0.1)
      // Slow        = 6-29 bottles in 60 days (velocity 0.1 to 0.5)
      // Moderate    = 30-59 bottles in 60 days (velocity 0.5 to 1.0)
      // ================================================
      // Products with velocity >= 1.0 are FAST-MOVING (not shown here)


      let status = "moderate";
      let recommendation = "monitor";


      if (totalQuantitySold === 0) {
        status = "no_sales";
        recommendation = "consider_discontinuing";
      } else if (velocity < 0.1) {
        status = "very_slow";
        recommendation = "reduce_inventory";
      } else if (velocity < 0.5) {
        status = "slow";
        recommendation = "promote_product";
      } else if (velocity < 1.0) {
        status = "moderate";
        recommendation = "monitor";
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
        currentStock: totalStock,
        velocity: parseFloat(velocity.toFixed(3)),
        daysOfInventory,
        productAge,
        status,
        recommendation
      };
    });


    // Filter for slow-moving products (velocity < 1.0 units/day)
    const slowMovingProducts = productsWithMetrics
      .filter(product => product.velocity < 1.0)
      .sort((a, b) => a.velocity - b.velocity);


    console.log("Slow-moving products:", slowMovingProducts.length);
    if (slowMovingProducts.length > 0) {
      console.log("Slowest product:", slowMovingProducts[0].productName,
                  "- Velocity:", slowMovingProducts[0].velocity);
    }


    const summary = {
      noSalesCount: slowMovingProducts.filter(p => p.status === "no_sales").length,
      verySlowCount: slowMovingProducts.filter(p => p.status === "very_slow").length,
      slowCount: slowMovingProducts.filter(p => p.status === "slow").length,
      moderateCount: slowMovingProducts.filter(p => p.status === "moderate").length,
      totalStockValue: slowMovingProducts.reduce(
        (sum, p) => sum + (p.currentStock * p.productPrice),
        0
      )
    };


    console.log("Summary:", summary);


    return NextResponse.json({
      success: true,
      data: {
        products: slowMovingProducts,
        summary
      }
    });


  } catch (error) {
    console.error("Slow-moving API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch slow-moving items",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
