// app/api/admin/reports/audit-trails/route.ts
// Read-only endpoint — audit_logs are append-only, cannot be mutated by any client.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth guard ────────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_role")
      .eq("id", user.id)
      .single();

    if (profile?.account_role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // ── Query params ──────────────────────────────────────────────────────
    const sp = request.nextUrl.searchParams;

    const page     = Math.max(1, parseInt(sp.get("page")  || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "50")));

    const action   = sp.get("action")    || "all";
    const module   = sp.get("module")    || "all";
    const search   = sp.get("search")    || "";
    const dateFrom = sp.get("date_from") || "";
    const dateTo   = sp.get("date_to")   || "";

    // ── Build query ───────────────────────────────────────────────────────
    // { count: "exact" } returns the total filtered count alongside the page of rows.
    let query = supabase
      .from("audit_logs")
      .select(
        "id, user_id, admin_name, admin_email, admin_role, action, module, entity_id, entity_label, old_value, new_value, metadata, ip_address, user_agent, created_at",
        { count: "exact" }
      );

    if (action !== "all") {
      // DB stores action as lowercase; frontend sends uppercase dropdown values
      query = query.eq("action", action.toLowerCase());
    }

    if (module !== "all") {
      query = query.eq("module", module);
    }

    if (search) {
      query = query.or(
        [
          `entity_id.ilike.%${search}%`,
          `admin_email.ilike.%${search}%`,
          `entity_label.ilike.%${search}%`,
          `admin_name.ilike.%${search}%`,
        ].join(",")
      );
    }

    if (dateFrom) {
      query = query.gte("created_at", new Date(dateFrom).toISOString());
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      query = query.lte("created_at", to.toISOString());
    }

    // Order and paginate
    const { data: logs, error, count: totalCount } = await query
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      console.error("[AuditTrails] Supabase error:", error.message, error.details);

      // Helpful hint when the table or columns don't exist yet
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json(
          {
            success: false,
            error: "The audit_logs table does not exist. Please run supabase_audit_v2_migration.sql in your Supabase SQL Editor.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const total      = totalCount ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    const transformed = (logs ?? []).map((log) => ({
      id:          log.id,
      userId:      log.user_id,
      adminName:   log.admin_name   ?? "Unknown",
      adminEmail:  log.admin_email  ?? "N/A",
      adminRole:   log.admin_role   ?? "admin",
      action:      log.action,
      module:      log.module       ?? "SYSTEM",
      entityId:    log.entity_id    ?? "",
      entityLabel: log.entity_label ?? null,
      oldValue:    log.old_value    ?? null,
      newValue:    log.new_value    ?? null,
      metadata:    log.metadata     ?? {},
      ipAddress:   log.ip_address   ?? "unknown",
      userAgent:   log.user_agent   ?? null,
      timestamp:   log.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        logs: transformed,
        totalCount:  total,
        totalPages,
        currentPage: page,
        pageSize,
      },
    });
  } catch (err) {
    console.error("[AuditTrails] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch audit trails" },
      { status: 500 }
    );
  }
}
