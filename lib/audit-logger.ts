// lib/audit-logger.ts
// Central audit logging utility — server-side only.
// All logs are INSERT-only; the DB trigger prevents any UPDATE/DELETE.

import { createClient } from "@/lib/supabase/server";

// ─── Action types ──────────────────────────────────────────────────────────
export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "VIEW"
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "PASSWORD_CHANGE"
  | "ACCOUNT_CREATE"
  | "ACCOUNT_DEACTIVATE"
  | "ACCOUNT_REACTIVATE"
  | "STOCK_IN"
  | "STOCK_OUT"
  | "STOCK_ADJUST"
  | "BULK_IMPORT"
  | "SETTINGS_UPDATE"
  | "CONFIG_CHANGE"
  | "IMAGE_UPLOAD"
  | "EXPORT"
  | "ROLE_CHANGE";

// ─── Module types ──────────────────────────────────────────────────────────
export type AuditModule =
  | "PRODUCT"
  | "CATEGORY"
  | "TAG"
  | "SIZE"
  | "ORDER"
  | "USER"
  | "INVENTORY"
  | "NOTIFICATION"
  | "FEEDBACK"
  | "AUTH"
  | "SETTINGS"
  | "SYSTEM"
  | "REPORT";

// ─── Log entry shape ───────────────────────────────────────────────────────
export interface AuditLogEntry {
  action: AuditAction;
  module: AuditModule;
  entityId?: string;
  entityLabel?: string; // human-readable name (product name, user email, etc.)
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ─── Legacy entity_type mapping ───────────────────────────────────────────
// entity_type is a legacy NOT-NULL column; `module` is the new canonical column.
// Map the module value to a valid legacy entity_type where possible.
const ENTITY_TYPE_MAP: Partial<Record<AuditModule, string>> = {
  PRODUCT:      "product",
  CATEGORY:     "category",
  ORDER:        "order",
  USER:         "user",
  INVENTORY:    "inventory",
  NOTIFICATION: "notification",
  SETTINGS:     "settings",
  // AUTH, SYSTEM, REPORT, TAG, SIZE, FEEDBACK → null (entity_type is nullable after migration)
};

// ─── Core logger ──────────────────────────────────────────────────────────

/**
 * Inserts a single audit log record.
 * Safe to call fire-and-forget (does not throw).
 *
 * @param entry  - The log data
 * @param request - Optional Next.js Request for IP + UA extraction
 * @param overrideUserId - Use when logging auth events where the
 *   session user differs from the actor (e.g. LOGIN_FAILED before session)
 */
export async function logAuditAction(
  entry: AuditLogEntry,
  request?: Request,
  overrideUserId?: string
): Promise<void> {
  try {
    const supabase = await createClient();

    // Resolve acting user
    let userId: string | null = overrideUserId ?? null;
    let adminName = "System";
    let adminEmail = "system@scentopia.com";
    let adminRole = "system";

    if (!overrideUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        userId = user.id;

        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, account_role")
          .eq("id", user.id)
          .single();

        adminName =
          profile
            ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
              user.email?.split("@")[0] ||
              "Unknown"
            : user.email?.split("@")[0] || "Unknown";

        adminEmail = user.email ?? "unknown@example.com";
        adminRole = profile?.account_role ?? "admin";
      }
    }

    // Extract IP / User-Agent from request headers
    let ip = entry.ipAddress ?? null;
    let ua = entry.userAgent ?? null;

    if (request) {
      ip =
        ip ??
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        request.headers.get("x-real-ip") ??
        "unknown";
      ua = ua ?? request.headers.get("user-agent") ?? "unknown";
    }

    const { error } = await supabase.from("audit_logs").insert({
      user_id:      userId,
      admin_name:   adminName,
      admin_email:  adminEmail,
      admin_role:   adminRole,
      // DB CHECK constraint requires lowercase action values
      action:       entry.action.toLowerCase(),
      // Legacy column — mapped from module; nullable after supabase_audit_fix_constraints.sql
      entity_type:  ENTITY_TYPE_MAP[entry.module] ?? null,
      // New canonical columns
      module:       entry.module,
      entity_id:    entry.entityId ?? "",
      entity_label: entry.entityLabel ?? null,
      old_value:    entry.oldValue ?? null,
      new_value:    entry.newValue ?? null,
      // Legacy changes column — kept for backward compat
      changes:      (entry.oldValue || entry.newValue)
                      ? { old: entry.oldValue ?? null, new: entry.newValue ?? null }
                      : null,
      metadata:     entry.metadata ?? {},
      ip_address:   ip ?? "unknown",
      user_agent:   ua ?? null,
    });

    if (error) {
      console.error("[AuditLogger] Insert failed:", error.message);
    }
  } catch (err) {
    // Never crash the calling request — just log
    console.error("[AuditLogger] Unexpected error:", err);
  }
}

// ─── Auth helpers ──────────────────────────────────────────────────────────

export async function logLogin(
  userId: string,
  email: string,
  request?: Request
) {
  await logAuditAction(
    {
      action: "LOGIN",
      module: "AUTH",
      entityId: userId,
      entityLabel: email,
      newValue: { email },
    },
    request,
    userId
  );
}

export async function logLoginFailed(email: string, request?: Request) {
  await logAuditAction(
    {
      action: "LOGIN_FAILED",
      module: "AUTH",
      entityId: "",
      entityLabel: email,
      metadata: { attempted_email: email },
    },
    request
  );
}

export async function logLogout(request?: Request) {
  await logAuditAction({ action: "LOGOUT", module: "AUTH" }, request);
}

export async function logPasswordChange(userId: string, request?: Request) {
  await logAuditAction(
    {
      action: "PASSWORD_CHANGE",
      module: "AUTH",
      entityId: userId,
    },
    request
  );
}

export async function logAccountCreate(
  newUserId: string,
  email: string,
  role: string,
  request?: Request
) {
  await logAuditAction(
    {
      action: "ACCOUNT_CREATE",
      module: "USER",
      entityId: newUserId,
      entityLabel: email,
      newValue: { email, role },
    },
    request
  );
}

export async function logAccountDeactivate(
  targetUserId: string,
  email: string,
  request?: Request
) {
  await logAuditAction(
    {
      action: "ACCOUNT_DEACTIVATE",
      module: "USER",
      entityId: targetUserId,
      entityLabel: email,
    },
    request
  );
}

export async function logAccountReactivate(
  targetUserId: string,
  email: string,
  request?: Request
) {
  await logAuditAction(
    {
      action: "ACCOUNT_REACTIVATE",
      module: "USER",
      entityId: targetUserId,
      entityLabel: email,
    },
    request
  );
}

export async function logRoleChange(
  targetUserId: string,
  email: string,
  oldRole: string,
  newRole: string,
  request?: Request
) {
  await logAuditAction(
    {
      action: "ROLE_CHANGE",
      module: "USER",
      entityId: targetUserId,
      entityLabel: email,
      oldValue: { role: oldRole },
      newValue: { role: newRole },
    },
    request
  );
}

// ─── Product helpers ───────────────────────────────────────────────────────

export async function logProductCreate(
  productId: string,
  productName: string,
  data: Record<string, unknown>,
  request?: Request
) {
  await logAuditAction(
    {
      action: "CREATE",
      module: "PRODUCT",
      entityId: productId,
      entityLabel: productName,
      newValue: data,
    },
    request
  );
}

export async function logProductUpdate(
  productId: string,
  productName: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  request?: Request
) {
  await logAuditAction(
    {
      action: "UPDATE",
      module: "PRODUCT",
      entityId: productId,
      entityLabel: productName,
      oldValue: oldData,
      newValue: newData,
    },
    request
  );
}

export async function logProductDelete(
  productId: string,
  productName: string,
  request?: Request
) {
  await logAuditAction(
    {
      action: "DELETE",
      module: "PRODUCT",
      entityId: productId,
      entityLabel: productName,
    },
    request
  );
}

export async function logImageUpload(
  productId: string,
  productName: string,
  imageUrls: string[],
  request?: Request
) {
  await logAuditAction(
    {
      action: "IMAGE_UPLOAD",
      module: "PRODUCT",
      entityId: productId,
      entityLabel: productName,
      newValue: { images: imageUrls },
    },
    request
  );
}

// ─── Category helpers ──────────────────────────────────────────────────────

export async function logCategoryCreate(
  categoryId: string,
  name: string,
  request?: Request
) {
  await logAuditAction(
    {
      action: "CREATE",
      module: "CATEGORY",
      entityId: categoryId,
      entityLabel: name,
      newValue: { name },
    },
    request
  );
}

export async function logCategoryUpdate(
  categoryId: string,
  oldName: string,
  newName: string,
  request?: Request
) {
  await logAuditAction(
    {
      action: "UPDATE",
      module: "CATEGORY",
      entityId: categoryId,
      entityLabel: newName,
      oldValue: { name: oldName },
      newValue: { name: newName },
    },
    request
  );
}

export async function logCategoryDelete(
  categoryId: string,
  name: string,
  request?: Request
) {
  await logAuditAction(
    {
      action: "DELETE",
      module: "CATEGORY",
      entityId: categoryId,
      entityLabel: name,
      oldValue: { name },
    },
    request
  );
}

// ─── Inventory helpers ─────────────────────────────────────────────────────

export async function logStockIn(
  productId: string,
  productName: string,
  size: string,
  quantity: number,
  previousStock: number,
  request?: Request
) {
  await logAuditAction(
    {
      action: "STOCK_IN",
      module: "INVENTORY",
      entityId: productId,
      entityLabel: productName,
      oldValue: { [size]: previousStock },
      newValue: { [size]: previousStock + quantity },
      metadata: { size, quantity_added: quantity },
    },
    request
  );
}

export async function logStockOut(
  productId: string,
  productName: string,
  size: string,
  quantity: number,
  previousStock: number,
  request?: Request
) {
  await logAuditAction(
    {
      action: "STOCK_OUT",
      module: "INVENTORY",
      entityId: productId,
      entityLabel: productName,
      oldValue: { [size]: previousStock },
      newValue: { [size]: previousStock - quantity },
      metadata: { size, quantity_removed: quantity },
    },
    request
  );
}

export async function logStockAdjust(
  productId: string,
  productName: string,
  oldStocks: Record<string, number>,
  newStocks: Record<string, number>,
  reason: string,
  request?: Request
) {
  await logAuditAction(
    {
      action: "STOCK_ADJUST",
      module: "INVENTORY",
      entityId: productId,
      entityLabel: productName,
      oldValue: oldStocks,
      newValue: newStocks,
      metadata: { reason },
    },
    request
  );
}

// ─── Settings helpers ──────────────────────────────────────────────────────

export async function logSettingsUpdate(
  settingKey: string,
  oldValue: unknown,
  newValue: unknown,
  request?: Request
) {
  await logAuditAction(
    {
      action: "SETTINGS_UPDATE",
      module: "SETTINGS",
      entityId: settingKey,
      entityLabel: settingKey,
      oldValue: { value: oldValue },
      newValue: { value: newValue },
    },
    request
  );
}

// ─── Export helper ─────────────────────────────────────────────────────────

export async function logExport(
  module: AuditModule,
  format: string,
  recordCount: number,
  request?: Request
) {
  await logAuditAction(
    {
      action: "EXPORT",
      module,
      entityId: "",
      metadata: { format, record_count: recordCount },
    },
    request
  );
}

// ─── POS helper ────────────────────────────────────────────────────────────

export async function logPOSSale(
  transactionId: string,
  transactionNumber: string,
  totalAmount: number,
  itemCount: number,
  request?: Request
) {
  await logAuditAction(
    {
      action: "CREATE",
      module: "ORDER",
      entityId: transactionId,
      entityLabel: transactionNumber,
      newValue: {
        transaction_number: transactionNumber,
        total_amount: totalAmount,
        item_count: itemCount,
        sale_source: "physical_store",
      },
      metadata: { sale_source: "physical_store" },
    },
    request
  );
}

// ─── Legacy compatibility (keeps old call-sites working) ──────────────────

/** @deprecated Use logProductUpdate instead */
export async function logInventoryUpdate(
  productId: string,
  oldStock: Record<string, number>,
  newStock: Record<string, number>,
  request?: Request
) {
  await logStockAdjust(productId, productId, oldStock, newStock, "Manual correction", request);
}

/** @deprecated Use logOrderCreate */
export async function logOrderCreate(
  orderId: string,
  orderData: Record<string, unknown>,
  request?: Request
) {
  await logAuditAction(
    {
      action: "CREATE",
      module: "ORDER",
      entityId: orderId,
      newValue: orderData,
    },
    request
  );
}

/** @deprecated Use logAuditAction directly */
export async function logOrderUpdate(
  orderId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  request?: Request
) {
  await logAuditAction(
    {
      action: "UPDATE",
      module: "ORDER",
      entityId: orderId,
      oldValue: oldData,
      newValue: newData,
    },
    request
  );
}
