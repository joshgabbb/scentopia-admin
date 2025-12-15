// app/api/admin/reports/audit-trails/route.ts
// Fetch audit logs with pagination, filtering, and search

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = 50;
    const actionFilter = searchParams.get("action") || "all";
    const entityFilter = searchParams.get("entity") || "all";
    const searchTerm = searchParams.get("search") || "";

    console.log("=== AUDIT TRAILS API ===");
    console.log("Page:", page);
    console.log("Action Filter:", actionFilter);
    console.log("Entity Filter:", entityFilter);
    console.log("Search Term:", searchTerm);

    // Build query
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' });

    // Apply filters
    if (actionFilter !== "all") {
      query = query.eq('action', actionFilter);
    }

    if (entityFilter !== "all") {
      query = query.eq('entity_type', entityFilter);
    }

    if (searchTerm) {
      query = query.ilike('entity_id', `%${searchTerm}%`);
    }

    // Get total count
    const { count } = await query;

    // Get paginated results
    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data: logs, error } = await query;

    if (error) {
      console.error("Audit logs error:", error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    console.log("Logs found:", logs?.length || 0);
    console.log("Total count:", count);

    // Transform logs to match frontend interface
    const transformedLogs = (logs || []).map(log => ({
      id: log.id,
      userId: log.user_id,
      adminName: log.admin_name || 'Unknown Admin',
      adminEmail: log.admin_email || 'N/A',
      adminRole: log.admin_role || 'admin',
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      changes: log.changes,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      timestamp: log.created_at
    }));

    const totalPages = Math.ceil((count || 0) / pageSize);

    return NextResponse.json({
      success: true,
      data: {
        logs: transformedLogs,
        totalPages,
        currentPage: page,
        totalCount: count || 0
      }
    });

  } catch (error) {
    console.error("Audit trails API error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch audit trails",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}