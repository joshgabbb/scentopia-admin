// app/admin/management/audit-trails/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Download, Search, ChevronRight, X,
  Shield, Calendar, Filter, RefreshCw,
} from "lucide-react";
import ExportModal, { ExportOptions } from "@/components/ExportModal";
import { exportReport, type ExportConfig } from "@/lib/export-utils";

// ─── Types ────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  userId: string;
  adminName: string;
  adminEmail: string;
  adminRole: string;
  action: string;
  module: string;
  entityId: string;
  entityLabel: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  ipAddress: string;
  userAgent: string | null;
  timestamp: string;
}

// ─── Constants ────────────────────────────────────────────────────────────

const ACTION_OPTIONS = [
  "all",
  "CREATE", "UPDATE", "DELETE", "VIEW",
  "LOGIN", "LOGOUT", "LOGIN_FAILED",
  "PASSWORD_CHANGE", "ACCOUNT_CREATE", "ACCOUNT_DEACTIVATE", "ACCOUNT_REACTIVATE",
  "STOCK_IN", "STOCK_OUT", "STOCK_ADJUST", "BULK_IMPORT",
  "SETTINGS_UPDATE", "IMAGE_UPLOAD", "EXPORT", "ROLE_CHANGE",
];

const MODULE_OPTIONS = [
  "all",
  "PRODUCT", "CATEGORY", "TAG", "SIZE",
  "ORDER", "USER", "INVENTORY",
  "NOTIFICATION", "FEEDBACK",
  "AUTH", "SETTINGS", "SYSTEM", "REPORT",
];

// ─── Styling helpers ──────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  CREATE:             "bg-emerald-50 text-emerald-700 border-emerald-200",
  UPDATE:             "bg-blue-50 text-blue-700 border-blue-200",
  DELETE:             "bg-red-50 text-red-600 border-red-200",
  LOGIN:              "bg-purple-50 text-purple-700 border-purple-200",
  LOGOUT:             "bg-gray-50 text-gray-600 border-gray-200",
  LOGIN_FAILED:       "bg-red-50 text-red-700 border-red-200",
  PASSWORD_CHANGE:    "bg-orange-50 text-orange-700 border-orange-200",
  ACCOUNT_CREATE:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  ACCOUNT_DEACTIVATE: "bg-red-50 text-red-700 border-red-200",
  ACCOUNT_REACTIVATE: "bg-green-50 text-green-700 border-green-200",
  STOCK_IN:           "bg-teal-50 text-teal-700 border-teal-200",
  STOCK_OUT:          "bg-amber-50 text-amber-700 border-amber-200",
  STOCK_ADJUST:       "bg-amber-50 text-amber-700 border-amber-200",
  BULK_IMPORT:        "bg-indigo-50 text-indigo-700 border-indigo-200",
  SETTINGS_UPDATE:    "bg-slate-50 text-slate-700 border-slate-200",
  IMAGE_UPLOAD:       "bg-pink-50 text-pink-700 border-pink-200",
  EXPORT:             "bg-cyan-50 text-cyan-700 border-cyan-200",
  ROLE_CHANGE:        "bg-violet-50 text-violet-700 border-violet-200",
  VIEW:               "bg-yellow-50 text-yellow-700 border-yellow-200",
};

const ACTION_DOTS: Record<string, string> = {
  CREATE:             "bg-emerald-500",
  UPDATE:             "bg-blue-500",
  DELETE:             "bg-red-500",
  LOGIN:              "bg-purple-500",
  LOGOUT:             "bg-gray-400",
  LOGIN_FAILED:       "bg-red-600",
  PASSWORD_CHANGE:    "bg-orange-500",
  ACCOUNT_CREATE:     "bg-emerald-500",
  ACCOUNT_DEACTIVATE: "bg-red-500",
  ACCOUNT_REACTIVATE: "bg-green-500",
  STOCK_IN:           "bg-teal-500",
  STOCK_OUT:          "bg-amber-500",
  STOCK_ADJUST:       "bg-amber-400",
  BULK_IMPORT:        "bg-indigo-500",
  SETTINGS_UPDATE:    "bg-slate-500",
  IMAGE_UPLOAD:       "bg-pink-500",
  EXPORT:             "bg-cyan-500",
  ROLE_CHANGE:        "bg-violet-500",
  VIEW:               "bg-yellow-500",
};

// DB stores action as lowercase; normalize to UPPERCASE before lookup
function actionBadge(action: string) {
  return ACTION_COLORS[action.toUpperCase()] ?? "bg-gray-50 text-gray-600 border-gray-200";
}
function actionDot(action: string) {
  return ACTION_DOTS[action.toUpperCase()] ?? "bg-gray-400";
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const delta = 2;
  const range: (number | "...")[] = [];
  for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
    range.push(i);
  }
  if (current - delta > 2) range.unshift("...");
  if (current + delta < total - 1) range.push("...");
  range.unshift(1);
  if (total > 1) range.push(total);
  return range;
}

const selectCls =
  "px-3 py-2 border border-[#e8e0d0] bg-white text-[#1c1810] text-sm rounded-sm " +
  "focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] " +
  "hover:border-[#D4AF37]/50 transition-colors";

// ─── Diff renderer ────────────────────────────────────────────────────────

function DiffView({
  oldVal,
  newVal,
}: {
  oldVal: Record<string, unknown> | null;
  newVal: Record<string, unknown> | null;
}) {
  if (!oldVal && !newVal) return null;

  const allKeys = Array.from(
    new Set([...Object.keys(oldVal ?? {}), ...Object.keys(newVal ?? {})])
  );

  if (allKeys.length === 0) return null;

  const changed = allKeys.filter(
    (k) => JSON.stringify((oldVal ?? {})[k]) !== JSON.stringify((newVal ?? {})[k])
  );

  if (changed.length === 0 && (oldVal || newVal)) {
    // No field-level diff — just render raw JSON
    return (
      <div className="space-y-2">
        {oldVal && (
          <div>
            <div className="text-xs font-semibold text-red-600 mb-1">Before</div>
            <pre className="bg-red-50 border border-red-100 p-3 rounded-sm text-xs text-[#1c1810] overflow-auto max-h-48 font-mono">
              {JSON.stringify(oldVal, null, 2)}
            </pre>
          </div>
        )}
        {newVal && (
          <div>
            <div className="text-xs font-semibold text-emerald-600 mb-1">After</div>
            <pre className="bg-emerald-50 border border-emerald-100 p-3 rounded-sm text-xs text-[#1c1810] overflow-auto max-h-48 font-mono">
              {JSON.stringify(newVal, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {changed.map((key) => (
        <div key={key} className="rounded-sm border border-[#e8e0d0] overflow-hidden text-xs font-mono">
          <div className="bg-[#faf8f3] px-3 py-1.5 font-sans font-semibold text-[#7a6a4a] text-xs uppercase tracking-wide">
            {key}
          </div>
          {oldVal && key in oldVal && (
            <div className="px-3 py-1.5 bg-red-50 text-red-700">
              <span className="select-none opacity-50 mr-1">−</span>
              {JSON.stringify((oldVal)[key])}
            </div>
          )}
          {newVal && key in newVal && (
            <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700">
              <span className="select-none opacity-50 mr-1">+</span>
              {JSON.stringify((newVal)[key])}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function AuditTrailsPage() {
  const router = useRouter();

  const [logs, setLogs]               = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [fetchError, setFetchError]   = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [totalCount, setTotalCount]   = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showExport, setShowExport]   = useState(false);

  // Filters
  const [search, setSearch]         = useState("");
  const [actionFilter, setAction]   = useState("all");
  const [moduleFilter, setModule]   = useState("all");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        page:      currentPage.toString(),
        action:    actionFilter,
        module:    moduleFilter,
        search,
        date_from: dateFrom,
        date_to:   dateTo,
      });
      const res    = await fetch(`/api/admin/reports/audit-trails?${params}`);
      const result = await res.json();
      if (result.success) {
        setLogs(result.data.logs);
        setTotalPages(result.data.totalPages);
        setTotalCount(result.data.totalCount);
      } else {
        setFetchError(result.error ?? "Failed to load audit logs");
        setLogs([]);
      }
    } catch (err) {
      setFetchError("Network error — could not reach the server");
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, actionFilter, moduleFilter, search, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function resetFilters() {
    setSearch("");
    setAction("all");
    setModule("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }

  function applyFilter<T>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) {
    setter(value);
    setCurrentPage(1);
  }

  const handleExport = (options: ExportOptions) => {
    const fmt = (ts: string) =>
      new Date(ts).toLocaleString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila",
      });

    const config: ExportConfig = {
      title:    "Audit Trail Report",
      subtitle: "System activity and change logs",
      filename: "audit_trails_report",
      headers:  ["Timestamp", "Admin", "Email", "Role", "Action", "Module", "Entity", "IP"],
      rows: logs.map((l) => [
        fmt(l.timestamp), l.adminName, l.adminEmail, l.adminRole,
        l.action, l.module, l.entityLabel ?? l.entityId, l.ipAddress ?? "N/A",
      ]),
      dateRange: options.dateRange,
      additionalInfo: [
        { label: "Total Records", value: totalCount.toString() },
        { label: "Action Filter", value: actionFilter },
        { label: "Module Filter", value: moduleFilter },
      ],
    };
    exportReport(config, options.format);
    setShowExport(false);
  };

  const hasActiveFilters = search || actionFilter !== "all" || moduleFilter !== "all" || dateFrom || dateTo;

  return (
    <>
      <div className="space-y-6">

        {/* Back nav */}
        <button
          onClick={() => router.push("/admin/management")}
          className="inline-flex items-center gap-2 text-sm text-[#7a6a4a] hover:text-[#8B6914] transition-colors group font-medium"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Management
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-sm flex items-center justify-center shrink-0">
              <Shield className="w-4.5 h-4.5 text-[#8B6914]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1c1810]">Audit Trails</h1>
              <p className="text-sm text-[#7a6a4a] mt-0.5">
                <span className="font-semibold text-[#8B6914]">{totalCount.toLocaleString()}</span> total records — immutable, read-only
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              className="p-2 border border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#faf8f3] hover:text-[#8B6914] hover:border-[#D4AF37]/40 rounded-sm transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowExport(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#D4AF37] text-[#1c1810] font-semibold text-sm hover:bg-[#C4A030] transition-colors rounded-sm shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export Logs
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-[#e8e0d0] rounded-sm p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#7a6a4a] uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" /> Filters
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="ml-auto text-[#8B6914] hover:text-[#D4AF37] font-semibold normal-case tracking-normal"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
            {/* Search */}
            <div className="relative xl:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a8a6a]" />
              <input
                type="text"
                placeholder="Search admin, entity, entity ID…"
                value={search}
                onChange={(e) => applyFilter(setSearch, e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-[#e8e0d0] bg-white text-[#1c1810] text-sm
                  placeholder-[#b0a080] rounded-sm focus:outline-none focus:ring-2
                  focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] transition-colors"
              />
            </div>
            {/* Action */}
            <select value={actionFilter} onChange={(e) => applyFilter(setAction, e.target.value)} className={selectCls}>
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>{a === "all" ? "All Actions" : a}</option>
              ))}
            </select>
            {/* Module */}
            <select value={moduleFilter} onChange={(e) => applyFilter(setModule, e.target.value)} className={selectCls}>
              {MODULE_OPTIONS.map((m) => (
                <option key={m} value={m}>{m === "all" ? "All Modules" : m}</option>
              ))}
            </select>
            {/* Date range */}
            <div className="flex items-center gap-1.5 sm:col-span-2 lg:col-span-1">
              <div className="relative flex-1">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9a8a6a]" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => applyFilter(setDateFrom, e.target.value)}
                  className="w-full pl-8 pr-2 py-2 border border-[#e8e0d0] bg-white text-[#1c1810] text-sm
                    rounded-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]
                    transition-colors"
                  title="From date"
                />
              </div>
              <span className="text-[#9a8a6a] text-xs shrink-0">to</span>
              <div className="relative flex-1">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9a8a6a]" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => applyFilter(setDateTo, e.target.value)}
                  className="w-full pl-8 pr-2 py-2 border border-[#e8e0d0] bg-white text-[#1c1810] text-sm
                    rounded-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]
                    transition-colors"
                  title="To date"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#e8e0d0] rounded-sm shadow-sm">
          {isLoading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-[#7a6a4a]">Loading audit logs…</p>
            </div>
          ) : fetchError ? (
            <div className="py-14 px-6 text-center">
              <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-sm flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="text-base font-semibold text-[#1c1810] mb-1">Could not load audit logs</h3>
              <p className="text-sm text-red-600 mb-4 max-w-lg mx-auto">{fetchError}</p>
              {fetchError.toLowerCase().includes("does not exist") && (
                <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-left max-w-lg mx-auto mb-4">
                  <p className="text-sm font-semibold text-amber-800 mb-1">Setup required</p>
                  <p className="text-xs text-amber-700">
                    Run <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">supabase_audit_v2_migration.sql</code> in your{" "}
                    <strong>Supabase → SQL Editor</strong>, then refresh this page.
                  </p>
                </div>
              )}
              <button
                onClick={fetchLogs}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4AF37] text-[#1c1810] text-sm font-semibold rounded-sm hover:bg-[#C4A030] transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-sm flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-[#8B6914]" />
              </div>
              <h3 className="text-base font-semibold text-[#1c1810] mb-1">No Audit Logs Found</h3>
              <p className="text-sm text-[#7a6a4a]">
                {hasActiveFilters ? "Try adjusting your filters" : "Logs will appear here as actions are performed"}
              </p>
              {hasActiveFilters && (
                <button onClick={resetFilters} className="mt-3 text-sm text-[#8B6914] hover:text-[#D4AF37] font-semibold">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-[#faf8f3] border-b border-[#e8e0d0]">
                  <tr>
                    {["Timestamp", "Admin", "Action", "Module", "Entity", "IP Address", "Details"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#7a6a4a] uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f5f0e8]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#faf8f3] transition-colors">
                      <td className="px-4 py-3.5 text-sm text-[#1c1810] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-sm text-[#1c1810]">{log.adminName}</div>
                        <div className="text-xs text-[#9a8a6a]">{log.adminEmail}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full border ${actionBadge(log.action)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${actionDot(log.action)}`} />
                          {log.action.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-semibold text-[#7a6a4a] bg-[#f5f0e8] px-2 py-0.5 rounded-sm">
                          {log.module}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 max-w-[160px]">
                        <div className="text-sm text-[#1c1810] truncate" title={log.entityLabel ?? log.entityId}>
                          {log.entityLabel
                            ? log.entityLabel.length > 22 ? log.entityLabel.substring(0, 22) + "…" : log.entityLabel
                            : log.entityId
                              ? log.entityId.substring(0, 8) + "…"
                              : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-[#7a6a4a] whitespace-nowrap">
                        {log.ipAddress || "N/A"}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-xs font-semibold text-[#8B6914] hover:text-[#D4AF37] hover:underline transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-4 border-t border-[#e8e0d0] flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-[#7a6a4a] font-medium">
                Page <span className="text-[#1c1810] font-bold">{currentPage}</span> of{" "}
                <span className="text-[#1c1810] font-bold">{totalPages}</span>
                {" · "}
                <span className="text-[#1c1810] font-bold">{totalCount.toLocaleString()}</span> records
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#f5f0e8] hover:border-[#D4AF37]/40 hover:text-[#8B6914] disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                  page === "..." ? (
                    <span key={`e-${idx}`} className="px-2 text-xs text-[#9a8a6a] select-none">…</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page as number)}
                      className={`min-w-[32px] h-8 px-2 text-xs font-semibold border transition-colors rounded-sm ${
                        currentPage === page
                          ? "bg-[#D4AF37] text-[#1c1810] border-[#D4AF37] shadow-sm"
                          : "border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#f5f0e8] hover:border-[#D4AF37]/40 hover:text-[#8B6914]"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#f5f0e8] hover:border-[#D4AF37]/40 hover:text-[#8B6914] disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <>
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40" onClick={() => setSelectedLog(null)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
            <div className="bg-white border border-[#e8e0d0] rounded-sm shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

              {/* Modal header */}
              <div className="px-6 py-4 border-b border-[#e8e0d0] flex items-start justify-between sticky top-0 bg-[#faf8f3] z-10">
                <div>
                  <h2 className="text-base font-bold text-[#1c1810]">Audit Log Details</h2>
                  <p className="text-xs text-[#7a6a4a] mt-0.5">{new Date(selectedLog.timestamp).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 text-[#9a8a6a] hover:text-[#1c1810] hover:bg-[#f0ebe0] rounded-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Admin",       value: selectedLog.adminName,  sub: selectedLog.adminEmail },
                    { label: "Role",        value: selectedLog.adminRole,  capitalize: true },
                    { label: "Module",      value: selectedLog.module },
                    { label: "IP Address",  value: selectedLog.ipAddress || "N/A" },
                  ].map((item) => (
                    <div key={item.label} className="bg-[#faf8f3] border border-[#e8e0d0] rounded-sm p-3">
                      <div className="text-xs text-[#7a6a4a] font-medium uppercase tracking-wide mb-1">{item.label}</div>
                      <div className={`font-semibold text-sm text-[#1c1810] ${item.capitalize ? "capitalize" : ""}`}>
                        {item.value}
                      </div>
                      {item.sub && <div className="text-xs text-[#9a8a6a] mt-0.5">{item.sub}</div>}
                    </div>
                  ))}

                  <div className="bg-[#faf8f3] border border-[#e8e0d0] rounded-sm p-3">
                    <div className="text-xs text-[#7a6a4a] font-medium uppercase tracking-wide mb-2">Action</div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${actionBadge(selectedLog.action)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${actionDot(selectedLog.action)}`} />
                      {selectedLog.action.toUpperCase()}
                    </span>
                  </div>

                  <div className="bg-[#faf8f3] border border-[#e8e0d0] rounded-sm p-3">
                    <div className="text-xs text-[#7a6a4a] font-medium uppercase tracking-wide mb-1">Entity</div>
                    {selectedLog.entityLabel && (
                      <div className="font-semibold text-sm text-[#1c1810]">{selectedLog.entityLabel}</div>
                    )}
                    <div className="font-mono text-xs text-[#9a8a6a] break-all">{selectedLog.entityId || "—"}</div>
                  </div>
                </div>

                {/* Changes diff */}
                {(selectedLog.oldValue || selectedLog.newValue) && (
                  <div>
                    <div className="text-xs text-[#7a6a4a] font-bold uppercase tracking-wider mb-2">Changes</div>
                    <DiffView oldVal={selectedLog.oldValue} newVal={selectedLog.newValue} />
                  </div>
                )}

                {/* Metadata */}
                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <div className="text-xs text-[#7a6a4a] font-bold uppercase tracking-wider mb-1.5">Metadata</div>
                    <pre className="bg-[#faf8f3] border border-[#e8e0d0] p-3 rounded-sm text-xs text-[#1c1810] overflow-auto max-h-40 font-mono">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* User Agent */}
                {selectedLog.userAgent && (
                  <div>
                    <div className="text-xs text-[#7a6a4a] font-bold uppercase tracking-wider mb-1.5">User Agent</div>
                    <div className="text-xs text-[#7a6a4a] break-all bg-[#faf8f3] border border-[#e8e0d0] p-3 rounded-sm">
                      {selectedLog.userAgent}
                    </div>
                  </div>
                )}

                {/* Log ID */}
                <div className="text-xs text-[#b0a080] font-mono border-t border-[#f0ebe0] pt-3">
                  Log ID: {selectedLog.id}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        onExport={handleExport}
        title="Export Audit Trails"
        totalRecords={totalCount}
        filteredRecords={logs.length}
        showDateRange={true}
      />
    </>
  );
}
