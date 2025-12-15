// app/api/admin/reports/feedback/route.ts
// FIXED VERSION - Works with your exact Supabase structure

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ITEMS_PER_PAGE = 20;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";

    // Build query
    let query = supabase.from('feedback').select('*', { count: 'exact' });

    // Apply filters
    if (status !== "all") {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`subject.ilike.%${search}%,message.ilike.%${search}%`);
    }

    // Get total count
    const { count } = await query;
    const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE);

    // Get paginated feedback
    const { data: feedback, error } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

    if (error) {
      console.error("Feedback error:", error);
      throw error;
    }

    // Get user info for each feedback separately
    const feedbackWithUsers = await Promise.all(
      (feedback || []).map(async (item) => {
        let customerName = "Anonymous";
        let customerEmail = "";

        if (item.user_id) {
          const { data: user } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', item.user_id)
            .single();

          if (user) {
            customerName = user.full_name || "Anonymous";
            customerEmail = user.email || "";
          }
        }

        return {
          id: item.id,
          userId: item.user_id,
          customerName,
          customerEmail,
          subject: item.subject,
          message: item.message,
          status: item.status,
          priority: item.priority,
          category: item.category,
          createdAt: item.created_at,
          adminResponse: item.admin_response,
          respondedAt: item.responded_at
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        feedback: feedbackWithUsers,
        totalPages,
        currentPage: page
      }
    });

  } catch (error) {
    console.error("Error fetching feedback:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch feedback",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, adminResponse, status } = body;

    const { data, error } = await supabase
      .from('feedback')
      .update({
        admin_response: adminResponse,
        status,
        responded_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error("Update feedback error:", error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error("Error updating feedback:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to update feedback",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}