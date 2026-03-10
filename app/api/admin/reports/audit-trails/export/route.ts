// app/api/admin/reports/audit-trails/export/route.ts
// Export audit logs to CSV

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const actionFilter = searchParams.get("action") || "all";
    const entityFilter = searchParams.get("entity") || "all";
    const searchTerm = searchParams.get("search") || "";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    console.log("=== EXPORT AUDIT TRAILS ===");
    console.log("Action Filter:", actionFilter);
    console.log("Entity Filter:", entityFilter);
    console.log("Search Term:", searchTerm);
    console.log("Date Range:", dateFrom, "to", dateTo);

    // Build query
    let query = supabase
      .from('audit_logs')
      .select('*');

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

    // Apply date range if provided
    if (dateFrom) {
      query = query.gte('created_at', new Date(dateFrom).toISOString());
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endDate.toISOString());
    }

    // Order by most recent first
    query = query.order('created_at', { ascending: false });

    const { data: logs, error } = await query;

    if (error) {
      console.error("Export error:", error);
      return new NextResponse("Export failed", { status: 500 });
    }

    if (!logs || logs.length === 0) {
      return new NextResponse("No data to export", { status: 404 });
    }

    console.log("Exporting", logs.length, "logs");

    // Create CSV
    const headers = [
      'Timestamp',
      'Admin Name',
      'Admin Email',
      'Admin Role',
      'Action',
      'Entity Type',
      'Entity ID',
      'IP Address',
      'User Agent',
      'Changes'
    ];

    const rows = logs.map(log => [
      new Date(log.created_at).toISOString(),
      `"${log.admin_name || 'Unknown'}"`,
      `"${log.admin_email || 'N/A'}"`,
      log.admin_role || 'admin',
      log.action,
      log.entity_type,
      log.entity_id,
      log.ip_address || 'N/A',
      `"${(log.user_agent || 'N/A').replace(/"/g, '""')}"`,
      `"${JSON.stringify(log.changes || {}).replace(/"/g, '""')}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    // Generate filename with filters
    let filename = 'audit-trails';
    if (actionFilter !== 'all') filename += `-${actionFilter}`;
    if (entityFilter !== 'all') filename += `-${entityFilter}`;
    filename += `-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error) {
    console.error("Export error:", error);
    return new NextResponse("Export failed", { status: 500 });
  }
}