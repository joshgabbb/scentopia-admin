// app/admin/management/audit-trails/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Download, Search, ChevronRight, X,
  Shield, Calendar, Filter, RefreshCw,
  PlusCircle, Pencil, Trash2, LogIn, LogOut, AlertTriangle,
  KeyRound, UserCheck, PackagePlus, PackageMinus, ClipboardList,
  Upload, Settings2, FileDown, UserCog, Eye, UserX,
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

// ─── Translation Maps ──────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  CREATE:             "Added",
  UPDATE:             "Updated",
  DELETE:             "Deleted",
  VIEW:               "Viewed",
  LOGIN:              "Logged In",
  LOGOUT:             "Logged Out",
  LOGIN_FAILED:       "Failed Login Attempt",
  PASSWORD_CHANGE:    "Changed Password",
  ACCOUNT_CREATE:     "Created Account",
  ACCOUNT_DEACTIVATE: "Suspended Account",
  ACCOUNT_REACTIVATE: "Reactivated Account",
  STOCK_IN:           "Restocked Items",
  STOCK_OUT:          "Removed Stock",
  STOCK_ADJUST:       "Adjusted Stock Count",
  BULK_IMPORT:        "Imported Products in Bulk",
  SETTINGS_UPDATE:    "Changed Shop Settings",
  IMAGE_UPLOAD:       "Uploaded Image",
  EXPORT:             "Exported Report",
  ROLE_CHANGE:        "Changed Staff Role",
  APPROVE:            "Approved",
  DECLINE:            "Declined",
  ARCHIVE:            "Archived",
  RESTORE:            "Restored",
  SUSPEND:            "Suspended Client",
  PO_CREATED:         "Created Purchase Order",
  PO_SENT:            "Sent Purchase Order",
  PO_RECEIVED:        "Received Purchase Order",
  PO_CANCELLED:       "Cancelled Purchase Order",
  PO_DELETED:         "Deleted Purchase Order",
};

const MODULE_LABELS: Record<string, string> = {
  PRODUCT:        "Products",
  CATEGORY:       "Categories",
  TAG:            "Tags",
  SIZE:           "Sizes",
  BUNDLE:         "Bundles",
  BARCODE:        "Barcodes",
  ORDER:          "Orders",
  USER:           "Customer Accounts",
  INVENTORY:      "Inventory",
  PURCHASE_ORDER: "Purchase Orders",
  CASHOUT:        "Payments & Cashouts",
  VOUCHER:        "Vouchers & Promos",
  REFUND:         "Refunds",
  NOTIFICATION:   "Notifications",
  FEEDBACK:       "Customer Feedback",
  AUTH:           "Login & Security",
  SETTINGS:       "Shop Settings",
  SYSTEM:         "System",
  REPORT:         "Reports",
};

const FIELD_LABELS: Record<string, string> = {
  stock_quantity: "Stock Quantity",
  base_price:     "Price",
  is_active:      "Active Status",
  category_id:    "Category",
  name:           "Name",
  description:    "Description",
  image_url:      "Product Image",
  images:         "Product Images",
  created_at:     "Date Created",
  updated_at:     "Last Updated",
  email:          "Email Address",
  account_role:   "Staff Role",
  is_verified:    "Verified",
  price:          "Price",
  status:         "Status",
  quantity:       "Quantity",
  size:           "Size",
  order_status:   "Order Status",
  phone:          "Phone Number",
  first_name:     "First Name",
  last_name:      "Last Name",
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  CREATE:             <PlusCircle className="w-3 h-3" />,
  UPDATE:             <Pencil className="w-3 h-3" />,
  DELETE:             <Trash2 className="w-3 h-3" />,
  VIEW:               <Eye className="w-3 h-3" />,
  LOGIN:              <LogIn className="w-3 h-3" />,
  LOGOUT:             <LogOut className="w-3 h-3" />,
  LOGIN_FAILED:       <AlertTriangle className="w-3 h-3" />,
  PASSWORD_CHANGE:    <KeyRound className="w-3 h-3" />,
  ACCOUNT_CREATE:     <PlusCircle className="w-3 h-3" />,
  ACCOUNT_DEACTIVATE: <UserX className="w-3 h-3" />,
  ACCOUNT_REACTIVATE: <UserCheck className="w-3 h-3" />,
  STOCK_IN:           <PackagePlus className="w-3 h-3" />,
  STOCK_OUT:          <PackageMinus className="w-3 h-3" />,
  STOCK_ADJUST:       <ClipboardList className="w-3 h-3" />,
  BULK_IMPORT:        <Upload className="w-3 h-3" />,
  SETTINGS_UPDATE:    <Settings2 className="w-3 h-3" />,
  IMAGE_UPLOAD:       <Upload className="w-3 h-3" />,
  EXPORT:             <FileDown className="w-3 h-3" />,
  ROLE_CHANGE:        <UserCog className="w-3 h-3" />,
  APPROVE:            <UserCheck className="w-3 h-3" />,
  DECLINE:            <UserX className="w-3 h-3" />,
  ARCHIVE:            <PackageMinus className="w-3 h-3" />,
  RESTORE:            <PackagePlus className="w-3 h-3" />,
  SUSPEND:            <UserX className="w-3 h-3" />,
  PO_CREATED:         <ClipboardList className="w-3 h-3" />,
  PO_SENT:            <Upload className="w-3 h-3" />,
  PO_RECEIVED:        <PackagePlus className="w-3 h-3" />,
  PO_CANCELLED:       <Trash2 className="w-3 h-3" />,
  PO_DELETED:         <Trash2 className="w-3 h-3" />,
};

// ─── Quick Filters ─────────────────────────────────────────────────────────

const QUICK_FILTERS = [
  { label: "All Activity",       action: "all", module: "all" },
  { label: "Products",           action: "all", module: "PRODUCT" },
  { label: "Inventory",          action: "all", module: "INVENTORY" },
  { label: "Orders",             action: "all", module: "ORDER" },
  { label: "Purchase Orders",    action: "all", module: "PURCHASE_ORDER" },
  { label: "Payments",           action: "all", module: "CASHOUT" },
  { label: "Vouchers",           action: "all", module: "VOUCHER" },
  { label: "Refunds",            action: "all", module: "REFUND" },
  { label: "Users",              action: "all", module: "USER" },
  { label: "Login & Security",   action: "all", module: "AUTH" },
];

// ─── Constants ────────────────────────────────────────────────────────────

const ACTION_GROUPS = [
  {
    label: "Catalog",
    options: ["CREATE", "UPDATE", "DELETE", "IMAGE_UPLOAD", "ARCHIVE", "RESTORE"],
  },
  {
    label: "Inventory",
    options: ["STOCK_IN", "STOCK_OUT", "STOCK_ADJUST"],
  },
  {
    label: "Purchase Orders",
    options: ["PO_CREATED", "PO_SENT", "PO_RECEIVED", "PO_CANCELLED", "PO_DELETED"],
  },
  {
    label: "Refunds & Reviews",
    options: ["APPROVE", "DECLINE"],
  },
  {
    label: "Customer Accounts",
    options: ["ACCOUNT_DEACTIVATE", "ACCOUNT_REACTIVATE", "SUSPEND", "ROLE_CHANGE"],
  },
  {
    label: "Login & Security",
    options: ["LOGIN", "LOGOUT", "LOGIN_FAILED", "PASSWORD_CHANGE"],
  },
  {
    label: "Other",
    options: ["EXPORT", "BULK_IMPORT", "SETTINGS_UPDATE"],
  },
];

const MODULE_OPTIONS = [
  "all",
  "PRODUCT", "CATEGORY", "TAG", "SIZE", "BUNDLE", "BARCODE",
  "ORDER", "USER", "INVENTORY", "PURCHASE_ORDER",
  "CASHOUT", "VOUCHER", "REFUND",
  "NOTIFICATION", "FEEDBACK",
  "AUTH", "SETTINGS", "SYSTEM", "REPORT",
];

// ─── Utility functions ─────────────────────────────────────────────────────

function toTitleCase(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "(none)";
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (typeof value === "number") {
    if (key.includes("price") || key.includes("cost") || key.includes("amount")) {
      return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
    }
    return String(value);
  }
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function resolveEntityLabel(label: string | null): string | null {
  if (!label) return null;
  // If it looks like a JSON object, extract the name field
  if (label.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(label);
      return parsed.name ?? parsed.title ?? parsed.email ?? parsed.order_number ?? null;
    } catch {
      // not valid JSON — fall through
    }
  }
  // If it's a raw UUID, shorten it
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(label)) {
    return `#${label.substring(0, 8).toUpperCase()}`;
  }
  return label;
}

const ORDER_STATUS_VERBS: Record<string, string> = {
  pending:    "placed",
  processing: "processed",
  shipped:    "shipped",
  delivered:  "marked as delivered",
  cancelled:  "cancelled",
  completed:  "completed",
  refunded:   "refunded",
  "out for delivery": "marked as out for delivery",
};

function buildSummary(log: AuditLog): string {
  const who = log.adminName || "Someone";
  const when = new Date(log.timestamp).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  // Clean order number — shorten UUID-style labels to #XXXXXXXX
  const rawLabel = log.entityLabel ?? null;
  const uuidMatch = rawLabel?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const orderNum = uuidMatch
    ? `#${uuidMatch[0].substring(0, 8).toUpperCase()}`
    : rawLabel ?? (log.entityId ? `#${log.entityId.substring(0, 8).toUpperCase()}` : null);

  // Purchase Order-specific summary
  if (log.module === "PURCHASE_ORDER") {
    const poNum = resolveEntityLabel(log.entityLabel) ?? orderNum ?? "a purchase order";
    const supplier = log.metadata?.["supplier"] as string | undefined;
    if (log.action === "PO_CREATED") {
      return `${who} created purchase order ${poNum}${supplier ? ` for ${supplier}` : ""} on ${when}.`;
    }
    if (log.action === "PO_SENT") {
      return `${who} sent purchase order ${poNum}${supplier ? ` to ${supplier}` : ""} on ${when}.`;
    }
    if (log.action === "PO_RECEIVED") {
      return `${who} received purchase order ${poNum} on ${when}.`;
    }
    if (log.action === "PO_CANCELLED") {
      return `${who} cancelled purchase order ${poNum} on ${when}.`;
    }
    if (log.action === "PO_DELETED") {
      return `${who} deleted purchase order ${poNum} on ${when}.`;
    }
  }

  // Order-specific summary using the new order_status value
  if (log.module === "ORDER") {
    const nv = log.newValue ?? {};
    const rawStatus = (
      (nv["order_status"] ?? nv["orderStatus"] ?? nv["status"]) as string | undefined
    )?.toLowerCase();
    const verb = rawStatus ? (ORDER_STATUS_VERBS[rawStatus] ?? `updated to ${rawStatus}`) : null;
    if (verb && orderNum) {
      return `${who} ${verb} order ${orderNum} on ${when}.`;
    }
    if (verb) {
      return `${who} ${verb} an order on ${when}.`;
    }
    if (orderNum) {
      return `${who} updated order ${orderNum} on ${when}.`;
    }
  }

  const what = (ACTION_LABELS[log.action.toUpperCase()] ?? log.action).toLowerCase();
  const where = resolveEntityLabel(log.entityLabel);
  return [who, what, where ? `"${where}"` : "", "on", when].filter(Boolean).join(" ").replace(/\s+/g, " ").trim() + ".";
}

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
  PO_CREATED:         "bg-emerald-50 text-emerald-700 border-emerald-200",
  PO_SENT:            "bg-blue-50 text-blue-700 border-blue-200",
  PO_RECEIVED:        "bg-teal-50 text-teal-700 border-teal-200",
  PO_CANCELLED:       "bg-orange-50 text-orange-700 border-orange-200",
  PO_DELETED:         "bg-red-50 text-red-600 border-red-200",
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

function actionBadge(action: string) {
  return ACTION_COLORS[action.toUpperCase()] ?? "bg-gray-50 text-gray-600 border-gray-200";
}
function actionDot(action: string) {
  return ACTION_DOTS[action.toUpperCase()] ?? "bg-gray-400";
}
function actionLabel(action: string) {
  return ACTION_LABELS[action.toUpperCase()] ?? toTitleCase(action);
}
function moduleLabel(module: string) {
  return MODULE_LABELS[module] ?? toTitleCase(module);
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
    return (
      <div className="space-y-2">
        <details>
          <summary className="text-xs text-[#7a6a4a] cursor-pointer select-none hover:text-[#8B6914] font-medium">
            Show full technical record
          </summary>
          <div className="mt-2 space-y-2">
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
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {changed.map((key) => (
        <div key={key} className="rounded-sm border border-[#e8e0d0] overflow-hidden text-xs">
          <div className="bg-[#faf8f3] px-3 py-1.5 font-semibold text-[#7a6a4a] text-xs">
            {FIELD_LABELS[key] ?? toTitleCase(key)}
          </div>
          {oldVal && key in oldVal && (
            <div className="px-3 py-1.5 bg-red-50 text-red-700">
              <span className="select-none opacity-50 mr-1">−</span>
              {formatValue(key, (oldVal)[key])}
            </div>
          )}
          {newVal && key in newVal && (
            <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700">
              <span className="select-none opacity-50 mr-1">+</span>
              {formatValue(key, (newVal)[key])}
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
        setFetchError(result.error ?? "Failed to load activity records");
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
      title:    "Activity History Report",
      subtitle: "A record of all actions performed in your shop",
      filename: "activity_history_report",
      headers:  ["Date & Time", "Done By", "Email", "Staff Role", "What Happened", "Area", "Item Affected"],
      rows: logs.map((l) => [
        fmt(l.timestamp),
        l.adminName,
        l.adminEmail,
        l.adminRole,
        ACTION_LABELS[l.action.toUpperCase()] ?? l.action,
        MODULE_LABELS[l.module] ?? l.module,
        l.entityLabel ?? (l.entityId ? `Record #${l.entityId.substring(0, 8)}` : "—"),
      ]),
      dateRange: options.dateRange,
      additionalInfo: [
        { label: "Total Records",        value: totalCount.toString() },
        { label: "Filtered by Activity", value: actionFilter === "all" ? "All" : (ACTION_LABELS[actionFilter] ?? actionFilter) },
        { label: "Filtered by Area",     value: moduleFilter === "all" ? "All Areas" : (MODULE_LABELS[moduleFilter] ?? moduleFilter) },
      ],
    };
    exportReport(config, options.format);
    setShowExport(false);
  };

  const hasActiveFilters = search || actionFilter !== "all" || moduleFilter !== "all" || dateFrom || dateTo;

  const activeQuickFilter = QUICK_FILTERS.find(
    (qf) => qf.action === actionFilter && qf.module === moduleFilter
  )?.label ?? null;

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
              <h1 className="text-xl font-bold text-[#1c1810]">Activity History</h1>
              <p className="text-sm text-[#7a6a4a] mt-0.5">
                <span className="font-semibold text-[#8B6914]">
                  {hasActiveFilters ? `${logs.length} of ${totalCount.toLocaleString()}` : totalCount.toLocaleString()}
                </span>{" "}
                activity records · All entries are permanent and cannot be altered
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
              Export
            </button>
          </div>
        </div>

        {/* Quick filter pills */}
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.label}
              onClick={() => {
                applyFilter(setAction, qf.action);
                applyFilter(setModule, qf.module);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                activeQuickFilter === qf.label
                  ? "bg-[#D4AF37] text-[#1c1810] border-[#D4AF37]"
                  : "bg-white text-[#7a6a4a] border-[#e8e0d0] hover:border-[#D4AF37]/50 hover:text-[#8B6914]"
              }`}
            >
              {qf.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border border-[#e8e0d0] rounded-sm p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#7a6a4a] uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" /> Filter Activity By:
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="ml-auto text-[#8B6914] hover:text-[#D4AF37] font-semibold normal-case tracking-normal"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Search — full width on its own row */}
            <div className="relative sm:col-span-2 lg:col-span-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a8a6a]" />
              <input
                type="text"
                placeholder="Search by name, product, or order…"
                value={search}
                onChange={(e) => applyFilter(setSearch, e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-[#e8e0d0] bg-white text-[#1c1810] text-sm
                  placeholder-[#b0a080] rounded-sm focus:outline-none focus:ring-2
                  focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] transition-colors"
              />
            </div>
            {/* Action Type */}
            <select
              value={actionFilter}
              onChange={(e) => applyFilter(setAction, e.target.value)}
              className={selectCls}
            >
              <option value="all">All Action Types</option>
              {ACTION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((a) => (
                    <option key={a} value={a}>
                      {ACTION_LABELS[a] ?? toTitleCase(a)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {/* Module / Area */}
            <select value={moduleFilter} onChange={(e) => applyFilter(setModule, e.target.value)} className={selectCls}>
              {MODULE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === "all" ? "All Areas" : (MODULE_LABELS[m] ?? toTitleCase(m))}
                </option>
              ))}
            </select>
            {/* Date from */}
            <div className="relative">
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
            {/* Date to */}
            <div className="relative">
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

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {actionFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs text-[#8B6914] rounded-full">
                  Activity: {ACTION_LABELS[actionFilter] ?? actionFilter}
                  <button onClick={() => applyFilter(setAction, "all")} className="hover:text-[#1c1810]"><X className="w-3 h-3" /></button>
                </span>
              )}
              {moduleFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs text-[#8B6914] rounded-full">
                  Area: {MODULE_LABELS[moduleFilter] ?? moduleFilter}
                  <button onClick={() => applyFilter(setModule, "all")} className="hover:text-[#1c1810]"><X className="w-3 h-3" /></button>
                </span>
              )}
              {dateFrom && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs text-[#8B6914] rounded-full">
                  From: {dateFrom}
                  <button onClick={() => applyFilter(setDateFrom, "")} className="hover:text-[#1c1810]"><X className="w-3 h-3" /></button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs text-[#8B6914] rounded-full">
                  To: {dateTo}
                  <button onClick={() => applyFilter(setDateTo, "")} className="hover:text-[#1c1810]"><X className="w-3 h-3" /></button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs text-[#8B6914] rounded-full">
                  Search: "{search}"
                  <button onClick={() => applyFilter(setSearch, "")} className="hover:text-[#1c1810]"><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-[#e8e0d0] rounded-sm shadow-sm">
          {isLoading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-[#7a6a4a]">Loading activity records…</p>
            </div>
          ) : fetchError ? (
            <div className="py-14 px-6 text-center">
              <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-sm flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="text-base font-semibold text-[#1c1810] mb-1">Could not load activity records</h3>
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
              <h3 className="text-base font-semibold text-[#1c1810] mb-1">No Activity Found</h3>
              <p className="text-sm text-[#7a6a4a] max-w-sm mx-auto">
                {hasActiveFilters
                  ? "No activity matches your current filters. Try widening your date range or selecting a different area."
                  : "No activity has been recorded yet. Records will appear here automatically as your shop is used."}
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
                    {["Date & Time", "Done By", "What Happened", "Area", "Item Affected", "Details"].map((h) => (
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
                      <td className="px-4 py-3.5 max-w-[280px]">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full border ${actionBadge(log.action)}`}>
                          {ACTION_ICONS[log.action.toUpperCase()]}
                          {actionLabel(log.action)}
                        </span>
                        <p className="text-xs text-[#7a6a4a] mt-1 leading-snug line-clamp-2">
                          {buildSummary(log)}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-semibold text-[#7a6a4a] bg-[#f5f0e8] px-2 py-0.5 rounded-sm">
                          {moduleLabel(log.module)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 max-w-[160px]">
                        {(() => {
                          const label = resolveEntityLabel(log.entityLabel) ?? (log.entityId ? `Record #${log.entityId.substring(0, 8)}` : "—");
                          return (
                            <div className="text-sm text-[#1c1810] truncate" title={label}>
                              {label.length > 22 ? label.substring(0, 22) + "…" : label}
                            </div>
                          );
                        })()}
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
                  <h2 className="text-base font-bold text-[#1c1810]">Activity Details</h2>
                  <p className="text-xs text-[#7a6a4a] mt-0.5">
                    {new Date(selectedLog.timestamp).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 text-[#9a8a6a] hover:text-[#1c1810] hover:bg-[#f0ebe0] rounded-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5">

                {/* Plain-English summary */}
                <div className="border-l-4 border-[#D4AF37] bg-[#faf8f3] px-4 py-3 rounded-sm">
                  <p className="text-sm text-[#1c1810] font-medium">{buildSummary(selectedLog)}</p>
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Done By",      value: selectedLog.adminName, sub: selectedLog.adminEmail },
                    { label: "Staff Role",   value: selectedLog.adminRole, capitalize: true },
                    { label: "Area of the Shop", value: moduleLabel(selectedLog.module) },
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
                    <div className="text-xs text-[#7a6a4a] font-medium uppercase tracking-wide mb-2">What Happened</div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${actionBadge(selectedLog.action)}`}>
                      {ACTION_ICONS[selectedLog.action.toUpperCase()]}
                      {actionLabel(selectedLog.action)}
                    </span>
                  </div>

                  <div className="bg-[#faf8f3] border border-[#e8e0d0] rounded-sm p-3">
                    <div className="text-xs text-[#7a6a4a] font-medium uppercase tracking-wide mb-1">Item Affected</div>
                    {(() => {
                      const label = resolveEntityLabel(selectedLog.entityLabel);
                      if (label) return <div className="font-semibold text-sm text-[#1c1810]">{label}</div>;
                      if (selectedLog.entityId) return <div className="text-sm text-[#7a6a4a]">Record #{selectedLog.entityId.substring(0, 8)}</div>;
                      return <div className="text-sm text-[#9a8a6a]">—</div>;
                    })()}
                  </div>
                </div>

                {/* Changes diff */}
                {(selectedLog.oldValue || selectedLog.newValue) && (
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#7a6a4a] font-bold mb-2">
                      <Pencil className="w-3.5 h-3.5" />
                      What was changed
                    </div>
                    <DiffView oldVal={selectedLog.oldValue} newVal={selectedLog.newValue} />
                  </div>
                )}

                {/* Technical details (collapsed) */}
                <details className="text-xs text-[#b0a080] border-t border-[#f0ebe0] pt-3">
                  <summary className="cursor-pointer select-none hover:text-[#7a6a4a] font-medium">
                    Technical Details
                  </summary>
                  <div className="font-mono mt-1">Record ID: {selectedLog.id}</div>
                </details>
              </div>
            </div>
          </div>
        </>
      )}

      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        onExport={handleExport}
        title="Export Activity History"
        totalRecords={totalCount}
        filteredRecords={logs.length}
        showDateRange={true}
      />
    </>
  );
}
