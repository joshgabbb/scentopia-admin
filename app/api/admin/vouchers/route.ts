import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAuditAction } from "@/lib/audit-logger";

// ─── GET: paginated voucher list ───────────────────────────────────────────
export async function GET(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "all"; // all | active | expired | inactive
  const search = searchParams.get("search") || "";
  const offset = (page - 1) * limit;

  try {
    let query = supabase.from("vouchers").select("*", { count: "exact" });

    if (search) {
      query = query.ilike("code", `%${search}%`);
    }

    const now = new Date().toISOString();
    if (status === "active") {
      query = query.eq("is_active", true).or(`valid_until.is.null,valid_until.gt.${now}`);
    } else if (status === "expired") {
      query = query.lt("valid_until", now);
    } else if (status === "inactive") {
      query = query.eq("is_active", false);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Summary stats
    const { data: statsAll } = await supabase.from("vouchers").select("id", { count: "exact" });
    const { data: statsActive } = await supabase
      .from("vouchers")
      .select("id", { count: "exact" })
      .eq("is_active", true)
      .or(`valid_until.is.null,valid_until.gt.${now}`);
    const { data: statsExpired } = await supabase
      .from("vouchers")
      .select("id", { count: "exact" })
      .lt("valid_until", now);
    const { data: usageSum } = await supabase.from("vouchers").select("used_count");

    const totalRedeemed = (usageSum || []).reduce((acc: number, v: any) => acc + (v.used_count || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        vouchers: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
        stats: {
          total: statsAll?.length ?? 0,
          active: statsActive?.length ?? 0,
          expired: statsExpired?.length ?? 0,
          totalRedeemed,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/admin/vouchers error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch vouchers" }, { status: 500 });
  }
}

// ─── POST: create voucher ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      usageLimit,
      validFrom,
      validUntil,
      sendNotification,
    } = body;

    if (!code || !discountType || discountValue == null) {
      return NextResponse.json(
        { success: false, error: "code, discountType, and discountValue are required" },
        { status: 400 }
      );
    }
    if (!["percentage", "fixed"].includes(discountType)) {
      return NextResponse.json({ success: false, error: "discountType must be 'percentage' or 'fixed'" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("vouchers")
      .insert({
        code: code.toUpperCase().trim(),
        description: description || null,
        discount_type: discountType,
        discount_value: Number(discountValue),
        min_order_amount: Number(minOrderAmount) || 0,
        max_discount_amount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
        usage_limit: usageLimit ? Number(usageLimit) : null,
        valid_from: validFrom || null,
        valid_until: validUntil || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ success: false, error: "A voucher with this code already exists" }, { status: 409 });
      }
      throw error;
    }

    // Optionally send notification to all users (customers + admins)
    if (sendNotification) {
      const discountLabel =
        discountType === "percentage"
          ? `${discountValue}% off`
          : `₱${Number(discountValue).toLocaleString()} off`;

      const notifBody = {
        title: `🎁 New Promo Code: ${code.toUpperCase()}`,
        message: description
          ? `${description}. Use code ${code.toUpperCase()} at checkout for ${discountLabel}.`
          : `Use code ${code.toUpperCase()} at checkout to get ${discountLabel}!`,
        type: "promotion",
        targetAudience: "customers",
        scheduledAt: null,
        imageUrl: null,
        metadata: {
          voucher_code: code.toUpperCase(),
          action: "promotion-redirect",
          discount_type: discountType,
          discount_value: discountValue,
          valid_until: validUntil || null,
        },
      };

      // Insert into admin_notifications and auto-send
      const { data: notif } = await supabase
        .from("admin_notifications")
        .insert({
          title: notifBody.title,
          message: notifBody.message,
          type: "promotion",
          target_audience: "all",
          status: "draft",
          created_by: user.id,
        })
        .select()
        .single();

      if (notif) {
        // Get all customer user IDs
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("is_active", true);

        const recipientIds = (profiles || []).map((p: any) => p.id);

        if (recipientIds.length > 0) {
          const notifRows = recipientIds.map((uid: string) => ({
            user_id: uid,
            notification_type: "discounts_and_vouchers",
            title: notifBody.title,
            body: notifBody.message,
            is_read: false,
            metadata: notifBody.metadata,
          }));
          await supabase.from("notifications").insert(notifRows);
        }

        await supabase
          .from("admin_notifications")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            recipient_count: recipientIds.length,
          })
          .eq("id", notif.id);
      }
    }

    logAuditAction(
      {
        action: "CREATE",
        module: "SYSTEM",
        entityId: data.id,
        entityLabel: `Voucher: ${data.code}`,
        newValue: { code: data.code, discountType, discountValue },
      },
      request
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("POST /api/admin/vouchers error:", error);
    return NextResponse.json({ success: false, error: "Failed to create voucher" }, { status: 500 });
  }
}

// ─── PUT: update voucher ───────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const updatePayload: Record<string, any> = {};
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.discountType !== undefined) updatePayload.discount_type = updates.discountType;
    if (updates.discountValue !== undefined) updatePayload.discount_value = Number(updates.discountValue);
    if (updates.minOrderAmount !== undefined) updatePayload.min_order_amount = Number(updates.minOrderAmount);
    if (updates.maxDiscountAmount !== undefined) updatePayload.max_discount_amount = updates.maxDiscountAmount ? Number(updates.maxDiscountAmount) : null;
    if (updates.usageLimit !== undefined) updatePayload.usage_limit = updates.usageLimit ? Number(updates.usageLimit) : null;
    if (updates.validFrom !== undefined) updatePayload.valid_from = updates.validFrom || null;
    if (updates.validUntil !== undefined) updatePayload.valid_until = updates.validUntil || null;
    if (updates.isActive !== undefined) updatePayload.is_active = updates.isActive;

    const { data, error } = await supabase
      .from("vouchers")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    logAuditAction(
      { action: "UPDATE", module: "SYSTEM", entityId: id, entityLabel: `Voucher: ${data?.code}`, newValue: updatePayload },
      request
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("PUT /api/admin/vouchers error:", error);
    return NextResponse.json({ success: false, error: "Failed to update voucher" }, { status: 500 });
  }
}

// ─── DELETE: remove voucher ────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

    const supabase = createAdminClient();

    const { data: voucher } = await supabase.from("vouchers").select("code, used_count").eq("id", id).single();

    if (voucher?.used_count > 0) {
      // Deactivate instead of delete
      await supabase.from("vouchers").update({ is_active: false }).eq("id", id);
      logAuditAction({ action: "UPDATE", module: "SYSTEM", entityId: id, entityLabel: `Voucher: ${voucher.code}`, metadata: { reason: "deactivated instead of deleted (has usage)" } }, request);
      return NextResponse.json({ success: true, message: "Voucher has been used — it was deactivated instead of deleted." });
    }

    const { error } = await supabase.from("vouchers").delete().eq("id", id);
    if (error) throw error;

    logAuditAction({ action: "DELETE", module: "SYSTEM", entityId: id, entityLabel: `Voucher: ${voucher?.code}` }, request);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/vouchers error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete voucher" }, { status: 500 });
  }
}
