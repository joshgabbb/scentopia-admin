// lib/audit-logger.ts
// Utility for logging admin actions to audit_logs table

import { createClient } from "@/lib/supabase/server";

export interface AuditLogData {
  action: 'create' | 'update' | 'delete' | 'view' | 'login' | 'logout';
  entityType: 'product' | 'order' | 'user' | 'category' | 'inventory' | 'notification' | 'settings';
  entityId: string;
  changes?: {
    old?: any;
    new?: any;
    [key: string]: any;
  };
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logAuditAction(
  data: AuditLogData,
  request?: Request
): Promise<void> {
  try {
    const supabase = await createClient();
    
    // Get current user (admin)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn("No user found for audit logging");
      return;
    }

    // Get user profile for additional info
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Extract IP and User Agent from request if provided
    let ipAddress = data.ipAddress;
    let userAgent = data.userAgent;
    
    if (request) {
      ipAddress = ipAddress || request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
      userAgent = userAgent || request.headers.get('user-agent') || 'unknown';
    }

    // Insert audit log
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        admin_name: profile?.name || user.email?.split('@')[0] || 'Unknown Admin',
        admin_email: user.email || 'unknown@example.com',
        admin_role: profile?.role || 'admin',
        action: data.action,
        entity_type: data.entityType,
        entity_id: data.entityId,
        changes: data.changes || null,
        ip_address: ipAddress || 'unknown',
        user_agent: userAgent || 'unknown'
      });

    if (error) {
      console.error("Failed to log audit action:", error);
    } else {
      console.log("✅ Audit log created:", data.action, data.entityType, data.entityId);
    }
  } catch (error) {
    console.error("Error in audit logging:", error);
  }
}

// Convenience functions for specific actions
export async function logProductUpdate(
  productId: string,
  oldData: any,
  newData: any,
  request?: Request
) {
  await logAuditAction({
    action: 'update',
    entityType: 'product',
    entityId: productId,
    changes: {
      old: oldData,
      new: newData
    }
  }, request);
}

export async function logInventoryUpdate(
  productId: string,
  oldStock: any,
  newStock: any,
  request?: Request
) {
  await logAuditAction({
    action: 'update',
    entityType: 'inventory',
    entityId: productId,
    changes: {
      old: { stocks: oldStock },
      new: { stocks: newStock }
    }
  }, request);
}

export async function logOrderCreate(
  orderId: string,
  orderData: any,
  request?: Request
) {
  await logAuditAction({
    action: 'create',
    entityType: 'order',
    entityId: orderId,
    changes: {
      new: orderData
    }
  }, request);
}

export async function logOrderUpdate(
  orderId: string,
  oldData: any,
  newData: any,
  request?: Request
) {
  await logAuditAction({
    action: 'update',
    entityType: 'order',
    entityId: orderId,
    changes: {
      old: oldData,
      new: newData
    }
  }, request);
}