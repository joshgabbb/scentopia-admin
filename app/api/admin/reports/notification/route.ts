// app/api/admin/reports/notifications/route.ts
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
    const type = searchParams.get("type") || "all";

    // Build query
    let query = supabase.from('admin_notifications').select('*', { count: 'exact' });

    // Apply filters
    if (status !== "all") {
      query = query.eq('status', status);
    }

    if (type !== "all") {
      query = query.eq('type', type);
    }

    // Get total count
    const { count } = await query;
    const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE);

    // Get paginated notifications
    const { data: notifications, error } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

    if (error) {
      console.error("Notifications error:", error);
      throw error;
    }

    // Format notifications
    const formattedNotifications = (notifications || []).map(notif => {
      const openRate = notif.recipient_count > 0
        ? parseFloat(((notif.opened_count / notif.recipient_count) * 100).toFixed(1))
        : 0;

      const clickRate = notif.recipient_count > 0
        ? parseFloat(((notif.clicked_count / notif.recipient_count) * 100).toFixed(1))
        : 0;

      return {
        id: notif.id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        status: notif.status,
        targetAudience: notif.target_audience,
        scheduledAt: notif.scheduled_at,
        sentAt: notif.sent_at,
        recipientCount: notif.recipient_count,
        openedCount: notif.opened_count,
        clickedCount: notif.clicked_count,
        openRate,
        clickRate,
        createdAt: notif.created_at,
        createdBy: notif.created_by
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        notifications: formattedNotifications,
        totalPages,
        currentPage: page
      }
    });

  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch notifications",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { title, message, type, targetAudience, scheduledAt } = body;

    // Get current admin user
    const { data: { user } } = await supabase.auth.getUser();
    const createdBy = user?.id || null;

    // Determine recipient count based on target audience
    let recipientCount = 0;
    try {
      if (targetAudience === "all") {
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        recipientCount = count || 0;
      } else if (targetAudience === "customers") {
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_role', 'customer');
        recipientCount = count || 0;
      } else if (targetAudience === "admins") {
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_role', 'admin');
        recipientCount = count || 0;
      }
    } catch (e) {
      console.error("Error counting recipients:", e);
      recipientCount = 0;
    }

    const { data, error } = await supabase
      .from('admin_notifications')
      .insert({
        title,
        message,
        type,
        status: scheduledAt ? "scheduled" : "draft",
        target_audience: targetAudience,
        scheduled_at: scheduledAt || null,
        recipient_count: recipientCount,
        opened_count: 0,
        clicked_count: 0,
        created_by: createdBy
      })
      .select()
      .single();

    if (error) {
      console.error("Create notification error:", error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error("Error creating notification:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to create notification",
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
    const { id, status } = body;

    const { data, error } = await supabase
      .from('admin_notifications')
      .update({
        status,
        sent_at: status === "sent" ? new Date().toISOString() : null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error("Update notification error:", error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error("Error updating notification:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to update notification",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}