// app/api/admin/users/route.ts
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAuditAction } from "@/lib/audit-logger";

// User status types
type UserStatus = 'active' | 'inactive' | 'suspended' | 'deactivated';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const search = searchParams.get('search') || '';
    const statusFilter = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    const includeArchived = searchParams.get('include_archived') === 'true';
    const archivedOnly = searchParams.get('archived_only') === 'true';
    const limit = 25;
    const offset = (page - 1) * limit;

    console.log('👥 Users API called with params:', {
      page, search, statusFilter, sortBy, sortOrder, includeArchived, archivedOnly
    });

    // Build query
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' });

    // Filter by archived status
    if (archivedOnly) {
      query = query.eq('is_archived', true);
    } else if (!includeArchived) {
      query = query.or('is_archived.is.null,is_archived.eq.false');
    }

    // Filter by status
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    // Apply server-side ordering before pagination
    switch (sortBy) {
      case 'name':
      case 'first_name':
        query = query.order('first_name', { ascending: sortOrder === 'asc' });
        break;
      case 'email':
        query = query.order('email', { ascending: sortOrder === 'asc' });
        break;
      case 'last_login':
        query = query.order('last_login', { ascending: sortOrder === 'asc', nullsFirst: false });
        break;
      case 'created_at':
      default:
        query = query.order('created_at', { ascending: sortOrder === 'asc' });
        break;
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;

    if (error) {
      console.error('❌ Supabase query error:', error);
      return NextResponse.json({
        success: false,
        error: 'Database query failed',
        details: error.message
      }, { status: 500 });
    }

    // Get order statistics for each user
    const userIds = users?.map(u => u.id) || [];
    let orderStats: Record<string, { orderCount: number; totalSpent: number; lastOrderDate: string | null; cancelledOrderCount: number }> = {};

    if (userIds.length > 0) {
      const { data: ordersData } = await supabase
        .from('orders')
        .select('user_id, amount, created_at, order_status')
        .in('user_id', userIds);

      if (ordersData) {
        ordersData.forEach(order => {
          if (!orderStats[order.user_id]) {
            orderStats[order.user_id] = { orderCount: 0, totalSpent: 0, lastOrderDate: null, cancelledOrderCount: 0 };
          }
          orderStats[order.user_id].orderCount += 1;
          orderStats[order.user_id].totalSpent += Number(order.amount) || 0;
          if (order.order_status === 'Cancelled') {
            orderStats[order.user_id].cancelledOrderCount += 1;
          }
          if (!orderStats[order.user_id].lastOrderDate ||
              new Date(order.created_at) > new Date(orderStats[order.user_id].lastOrderDate!)) {
            orderStats[order.user_id].lastOrderDate = order.created_at;
          }
        });
      }
    }

    // Format users
    let formattedUsers = users?.map(user => ({
      id: user.id,
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      email: user.email || '',
      phone: user.phone || '',
      status: user.status || 'active',
      isArchived: user.is_archived || false,
      archivedAt: user.archived_at || null,
      createdAt: user.created_at || null,
      updatedAt: user.updated_at || null,
      lastLogin: user.last_login || null,
      orderCount: orderStats[user.id]?.orderCount || 0,
      totalSpent: orderStats[user.id]?.totalSpent || 0,
      lastOrderDate: orderStats[user.id]?.lastOrderDate || null,
      cancelledOrderCount: orderStats[user.id]?.cancelledOrderCount || 0
    })) || [];

    // Apply search filter (client-side for flexibility)
    if (search) {
      const searchLower = search.toLowerCase();
      formattedUsers = formattedUsers.filter(user =>
        user.firstName.toLowerCase().includes(searchLower) ||
        user.lastName.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.phone.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting (client-side for flexibility with missing columns)
    formattedUsers.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortBy) {
        case 'name':
        case 'first_name':
          aVal = `${a.firstName} ${a.lastName}`.toLowerCase();
          bVal = `${b.firstName} ${b.lastName}`.toLowerCase();
          break;
        case 'email':
          aVal = a.email.toLowerCase();
          bVal = b.email.toLowerCase();
          break;
        case 'last_login':
          aVal = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
          bVal = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
          break;
        case 'created_at':
        default:
          aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        users: formattedUsers,
        totalCount: count || 0,
        totalPages,
        currentPage: page
      }
    });

  } catch (error) {
    console.error('❌ Users API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch users',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { id, firstName, lastName, phone, status } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log('📝 Updating user:', id, { firstName, lastName, phone, status });

    const updateData: Record<string, any> = {};

    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (status !== undefined) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data: updatedUser, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ User update error:', error);
      throw error;
    }

    console.log('✅ User updated successfully');

    const userEmail = updatedUser.email ?? id;
    if (status === 'suspended') {
      logAuditAction({ action: "SUSPEND", module: "USER", entityId: id, entityLabel: userEmail, metadata: { status: 'suspended' } }, request);
    } else if (status === 'active') {
      logAuditAction({ action: "RESTORE", module: "USER", entityId: id, entityLabel: userEmail, metadata: { status: 'active' } }, request);
    } else if (Object.keys(updateData).length > 0) {
      logAuditAction({ action: "UPDATE", module: "USER", entityId: id, entityLabel: userEmail, newValue: updateData }, request);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedUser.id,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        status: updatedUser.status || 'active'
      }
    });

  } catch (error) {
    console.error('❌ User update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');
    const action = searchParams.get('action') || 'archive'; // 'archive' or 'restore'

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (action === 'restore') {
      // Restore from archive
      console.log('♻️ Restoring user:', userId);

      const { error } = await supabase
        .from('profiles')
        .update({
          is_archived: false,
          archived_at: null,
          status: 'active'
        })
        .eq('id', userId);

      if (error) throw error;

      logAuditAction({ action: "RESTORE", module: "USER", entityId: userId, metadata: { action: "restored from archive" } }, request);

      return NextResponse.json({
        success: true,
        message: 'User restored successfully'
      });
    }

    // Archive user (soft delete)
    console.log('📦 Archiving user:', userId);

    const { error } = await supabase
      .from('profiles')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
        status: 'inactive'
      })
      .eq('id', userId);

    if (error) throw error;

    console.log('✅ User archived successfully');

    logAuditAction({ action: "ARCHIVE", module: "USER", entityId: userId, metadata: { action: "archived" } }, request);

    return NextResponse.json({
      success: true,
      message: 'User archived successfully'
    });

  } catch (error) {
    console.error('❌ User archive error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to archive user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
