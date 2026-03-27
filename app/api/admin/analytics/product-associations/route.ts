// app/api/admin/analytics/product-associations/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface ProductInfo {
  id: string;
  name: string;
  price: number;
  image: string | null;
  totalSold: number;
  revenue: number;
  orderCount: number;
}

interface AssociationRule {
  antecedent: ProductInfo;
  consequent: ProductInfo;
  support: number;
  confidence: number;
  lift: number;
  coOccurrences: number;
}

interface BundleRecommendation {
  topSeller: ProductInfo;
  slowMover: ProductInfo;
  confidence: number;
  lift: number;
  potentialRevenue: number;
  suggestedDiscount: number;
  bundlePrice: number;
  reasoning: string;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "90");
    const minSupport = parseFloat(searchParams.get("min_support") || "0.01");
    const minConfidence = parseFloat(searchParams.get("min_confidence") || "0.1");

    console.log("📊 Product Associations API called:", { days, minSupport, minConfidence });

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch all orders with their items (completed/delivered orders only)
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        created_at,
        order_status,
        order_items!order_items_order_id_fkey(
          id,
          product_id,
          quantity,
          item_amount,
          products(
            id,
            name,
            price,
            images
          )
        )
      `)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .in("order_status", ["Delivered", "Shipped", "Processing", "Pending"]);

    if (ordersError) {
      console.error("❌ Orders fetch error:", ordersError);
      throw ordersError;
    }

    console.log(`✅ Fetched ${orders?.length || 0} orders`);

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          associationRules: [],
          bundleRecommendations: [],
          topSellers: [],
          slowMovers: [],
          summary: {
            totalOrders: 0,
            totalProducts: 0,
            averageBasketSize: 0,
            rulesFound: 0,
          },
        },
      });
    }

    // Build product statistics
    const productStats: Map<string, ProductInfo> = new Map();
    const baskets: string[][] = [];
    let totalItems = 0;

    orders.forEach((order) => {
      const orderItems = order.order_items || [];
      const basket: string[] = [];

      orderItems.forEach((item: any) => {
        if (item.products && item.product_id) {
          const productId = item.product_id;
          basket.push(productId);
          totalItems += item.quantity || 1;

          const existing = productStats.get(productId);
          if (existing) {
            existing.totalSold += item.quantity || 1;
            existing.revenue += Number(item.item_amount) || 0;
            existing.orderCount += 1;
          } else {
            productStats.set(productId, {
              id: productId,
              name: item.products.name || "Unknown Product",
              price: Number(item.products.price) || 0,
              image: item.products.images?.[0] || null,
              totalSold: item.quantity || 1,
              revenue: Number(item.item_amount) || 0,
              orderCount: 1,
            });
          }
        }
      });

      if (basket.length > 0) {
        baskets.push([...new Set(basket)]); // Remove duplicates within basket
      }
    });

    const totalOrders = baskets.length;
    const averageBasketSize = totalOrders > 0 ? totalItems / totalOrders : 0;

    console.log(`📦 Baskets: ${totalOrders}, Products: ${productStats.size}, Avg basket: ${averageBasketSize.toFixed(2)}`);

    // Calculate co-occurrence matrix for pairs
    const pairCounts: Map<string, number> = new Map();
    const singleCounts: Map<string, number> = new Map();

    baskets.forEach((basket) => {
      // Count single items
      basket.forEach((item) => {
        singleCounts.set(item, (singleCounts.get(item) || 0) + 1);
      });

      // Count pairs (order doesn't matter for support, but we track both directions for confidence)
      for (let i = 0; i < basket.length; i++) {
        for (let j = i + 1; j < basket.length; j++) {
          const pairKey = [basket[i], basket[j]].sort().join("||");
          pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
        }
      }
    });

    // Generate association rules
    const associationRules: AssociationRule[] = [];

    pairCounts.forEach((count, pairKey) => {
      const [productA, productB] = pairKey.split("||");
      const support = count / totalOrders;

      if (support >= minSupport) {
        const countA = singleCounts.get(productA) || 0;
        const countB = singleCounts.get(productB) || 0;

        // Rule A -> B
        const confidenceAB = countA > 0 ? count / countA : 0;
        const expectedAB = (countA / totalOrders) * (countB / totalOrders);
        const liftAB = expectedAB > 0 ? (count / totalOrders) / expectedAB : 0;

        // Rule B -> A
        const confidenceBA = countB > 0 ? count / countB : 0;
        const liftBA = liftAB; // Lift is symmetric

        const productInfoA = productStats.get(productA);
        const productInfoB = productStats.get(productB);

        if (productInfoA && productInfoB) {
          if (confidenceAB >= minConfidence) {
            associationRules.push({
              antecedent: productInfoA,
              consequent: productInfoB,
              support,
              confidence: confidenceAB,
              lift: liftAB,
              coOccurrences: count,
            });
          }

          if (confidenceBA >= minConfidence) {
            associationRules.push({
              antecedent: productInfoB,
              consequent: productInfoA,
              support,
              confidence: confidenceBA,
              lift: liftBA,
              coOccurrences: count,
            });
          }
        }
      }
    });

    // Sort association rules by lift (most significant relationships first)
    associationRules.sort((a, b) => b.lift - a.lift);

    console.log(`🔗 Found ${associationRules.length} association rules`);

    // Fetch active, non-archived product IDs to filter out inactive/archived from suggestions
    const { data: activeProducts } = await supabase
      .from("products")
      .select("id, name, price, images")
      .eq("is_active", true)
      .eq("is_archived", false);

    const activeProductIds = new Set((activeProducts || []).map((p: any) => p.id));

    // Filter productStats to only include active, non-archived products
    for (const id of Array.from(productStats.keys())) {
      if (!activeProductIds.has(id)) {
        productStats.delete(id);
      }
    }

    // Identify top sellers and slow movers (only active, non-archived)
    const allProducts = Array.from(productStats.values());
    allProducts.sort((a, b) => b.totalSold - a.totalSold);

    const topSellers = allProducts.slice(0, Math.min(10, Math.ceil(allProducts.length * 0.2)));
    const slowMovers = allProducts
      .slice(Math.max(0, Math.ceil(allProducts.length * 0.5)))
      .filter((p) => p.totalSold > 0)
      .slice(0, 10);

    // Add active, non-archived products with zero sales from database
    const { data: zeroSalesProducts, error: zeroSalesError } = await supabase
      .from("products")
      .select("id, name, price, images")
      .eq("is_active", true)
      .eq("is_archived", false);

    if (!zeroSalesError && zeroSalesProducts) {
      const soldProductIds = new Set(allProducts.map((p) => p.id));
      const noSalesProducts = zeroSalesProducts
        .filter((p: any) => !soldProductIds.has(p.id))
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price) || 0,
          image: p.images?.[0] || null,
          totalSold: 0,
          revenue: 0,
          orderCount: 0,
        }))
        .slice(0, 5);

      slowMovers.push(...noSalesProducts);
    }

    // Generate bundle recommendations (pair top sellers with slow movers)
    const bundleRecommendations: BundleRecommendation[] = [];

    topSellers.forEach((topSeller) => {
      slowMovers.forEach((slowMover) => {
        if (topSeller.id === slowMover.id) return;

        // Check if there's an existing association
        const existingRule = associationRules.find(
          (rule) =>
            (rule.antecedent.id === topSeller.id && rule.consequent.id === slowMover.id) ||
            (rule.antecedent.id === slowMover.id && rule.consequent.id === topSeller.id)
        );

        // Calculate potential bundle metrics
        const combinedPrice = topSeller.price + slowMover.price;
        const suggestedDiscount = slowMover.totalSold === 0 ? 20 : 15; // Higher discount for zero-sales products
        const bundlePrice = combinedPrice * (1 - suggestedDiscount / 100);

        // Estimate potential revenue based on top seller's order count
        const potentialOrders = Math.ceil(topSeller.orderCount * 0.1); // Conservative 10% conversion
        const potentialRevenue = potentialOrders * bundlePrice;

        let reasoning = "";
        if (existingRule) {
          reasoning = `These products are already bought together ${existingRule.coOccurrences} times with ${(existingRule.confidence * 100).toFixed(1)}% confidence. Bundling can increase conversion.`;
        } else if (slowMover.totalSold === 0) {
          reasoning = `${slowMover.name} has no sales. Pairing with popular ${topSeller.name} can introduce it to customers.`;
        } else {
          reasoning = `${slowMover.name} is slow-moving (${slowMover.totalSold} sold). Bundling with ${topSeller.name} (${topSeller.totalSold} sold) can boost visibility.`;
        }

        bundleRecommendations.push({
          topSeller,
          slowMover,
          confidence: existingRule?.confidence || 0,
          lift: existingRule?.lift || 1,
          potentialRevenue,
          suggestedDiscount,
          bundlePrice,
          reasoning,
        });
      });
    });

    // Sort recommendations by potential impact (lift first, then potential revenue)
    bundleRecommendations.sort((a, b) => {
      // Prioritize existing associations with high lift
      if (a.lift > 1 && b.lift <= 1) return -1;
      if (b.lift > 1 && a.lift <= 1) return 1;
      // Then by potential revenue
      return b.potentialRevenue - a.potentialRevenue;
    });

    // Limit to top recommendations
    const topRecommendations = bundleRecommendations.slice(0, 15);

    console.log(`💡 Generated ${topRecommendations.length} bundle recommendations`);

    return NextResponse.json({
      success: true,
      data: {
        associationRules: associationRules.slice(0, 50), // Top 50 rules
        bundleRecommendations: topRecommendations,
        topSellers,
        slowMovers: slowMovers.slice(0, 10),
        summary: {
          totalOrders,
          totalProducts: productStats.size,
          averageBasketSize: Math.round(averageBasketSize * 100) / 100,
          rulesFound: associationRules.length,
          periodDays: days,
        },
      },
    });
  } catch (error) {
    console.error("❌ Product Associations API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to analyze product associations",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
