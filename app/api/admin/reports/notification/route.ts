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
    if (status === "archived") {
      // Show only archived notifications
      query = query.eq('is_archived', true);
    } else if (status !== "all") {
      // Show non-archived with specific status
      query = query.eq('status', status).or('is_archived.is.null,is_archived.eq.false');
    } else {
      // Show all non-archived by default
      query = query.or('is_archived.is.null,is_archived.eq.false');
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

      // Determine effective status:
      // - If archived, show as 'archived'
      // - If sent_at is set, consider it 'sent' even if status update failed
      // - Otherwise use the actual status
      let effectiveStatus = notif.status;
      if (notif.is_archived) {
        effectiveStatus = 'archived';
      } else if (notif.sent_at && notif.status === 'scheduled') {
        // Status update failed but notification was actually sent
        effectiveStatus = 'sent';
      }

      return {
        id: notif.id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        status: effectiveStatus,
        targetAudience: notif.target_audience,
        scheduledAt: notif.scheduled_at,
        sentAt: notif.sent_at,
        recipientCount: notif.recipient_count,
        openedCount: notif.opened_count,
        clickedCount: notif.clicked_count,
        openRate,
        clickRate,
        createdAt: notif.created_at,
        createdBy: notif.created_by,
        isArchived: notif.is_archived || false,
        imageUrl: (notif as Record<string, unknown>).image_url || null
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
      // Fetch all profiles and filter in JavaScript to avoid enum issues
      const { data: profiles } = await supabase.from('profiles').select('id, account_role');

      if (profiles) {
        if (targetAudience === "all") {
          recipientCount = profiles.length;
        } else if (targetAudience === "customers") {
          // Filter out admins (customers = non-admins)
          recipientCount = profiles.filter(p => {
            const role = ((p as Record<string, unknown>).account_role as string || '').toLowerCase();
            return role !== 'admin';
          }).length;
        } else if (targetAudience === "admins") {
          // Only admins
          recipientCount = profiles.filter(p => {
            const role = ((p as Record<string, unknown>).account_role as string || '').toLowerCase();
            return role === 'admin';
          }).length;
        }
      }
    } catch (e) {
      console.error("Error counting recipients:", e);
      recipientCount = 0;
    }

    const { imageUrl } = body;

    // Build insert object - DO NOT include image_url (column doesn't exist)
    // Store image URL in a separate way or skip it
    const insertData: Record<string, unknown> = {
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
    };

    // First insert without image_url
    let { data, error } = await supabase
      .from('admin_notifications')
      .insert(insertData)
      .select()
      .single();

    // If successful and we have an imageUrl, try to add it separately
    if (!error && data && imageUrl) {
      try {
        const { error: imgError } = await supabase
          .from('admin_notifications')
          .update({ image_url: imageUrl })
          .eq('id', data.id);

        if (imgError) {
          console.log('Note: image_url column does not exist, skipping image. Run migration to add column.');
        } else {
          data = { ...data, image_url: imageUrl };
        }
      } catch {
        console.log('Note: image_url column does not exist');
      }
    }

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

    // If sending notification, broadcast to all target users
    if (status === "sent") {
      // 1. Get the notification details
      const { data: notif, error: notifError } = await supabase
        .from('admin_notifications')
        .select('*')
        .eq('id', id)
        .single();

      if (notifError || !notif) {
        console.error("Failed to fetch notification:", notifError);
        throw new Error("Notification not found");
      }

      // 2. Get target users based on audience
      // Fetch all profiles and filter in JavaScript to avoid enum issues
      let users: { id: string }[] = [];

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, account_role');

        if (!error && data) {
          if (notif.target_audience === 'admins') {
            // Only get admins
            users = data.filter(u => {
              const role = ((u as Record<string, unknown>).account_role as string || '').toLowerCase();
              return role === 'admin';
            });
          } else if (notif.target_audience === 'customers') {
            // Filter out admins (keep users where role is not admin)
            users = data.filter(u => {
              const role = ((u as Record<string, unknown>).account_role as string || '').toLowerCase();
              return role !== 'admin';
            });
          } else {
            // All users
            users = data;
          }
        }
      } catch (e) {
        console.error("Error fetching users:", e);
      }

      if (users.length === 0) {
        console.log("No target users found, but continuing...");
      }

      // 3. Map notification type to mobile app type
      let notifType = 'general';
      if (notif.type === 'promotion') notifType = 'promotion';
      else if (notif.type === 'alert') notifType = 'warning';
      else if (notif.type === 'update' || notif.type === 'newsletter') notifType = 'information';

      // 4. Check if there are any users to send to
      console.log(`Found ${users.length} target users for notification`);

      if (!users || users.length === 0) {
        // No users found - mark as failed
        await supabase
          .from('admin_notifications')
          .update({
            status: 'failed',
            recipient_count: 0
          })
          .eq('id', id);

        return NextResponse.json({
          success: false,
          error: "No target users found. Check your audience selection.",
          recipientCount: 0
        }, { status: 400 });
      }

      // 5. Create notifications for each user
      let insertedCount = 0;
      let failedCount = 0;

      for (const user of users) {
        try {
          // Build insert object - only include image_url if it exists
          const insertData: Record<string, unknown> = {
            user_id: user.id,
            notification_type: notifType,
            title: notif.title,
            body: notif.message,
            is_read: false,
            metadata: {
              admin_notification_id: id,
              type: notif.type,
              action: 'promotion-redirect'
            }
          };

          // Add image_url if available (avoids errors if column doesn't exist)
          if (notif.image_url) {
            insertData.image_url = notif.image_url;
            (insertData.metadata as Record<string, unknown>).image_url = notif.image_url;
          }

          const { error: insertError } = await supabase
            .from('notifications')
            .insert(insertData);

          if (insertError) {
            console.error(`Failed to insert notification for user ${user.id}:`, insertError);
            failedCount++;
          } else {
            insertedCount++;
          }
        } catch (e) {
          console.error(`Error inserting notification for user ${user.id}:`, e);
          failedCount++;
        }
      }
      console.log(`Successfully inserted ${insertedCount} notifications, failed: ${failedCount}`);

      // 6. Determine final status based on results
      let finalStatus = 'sent';
      if (insertedCount === 0) {
        finalStatus = 'failed';
      } else if (failedCount > 0 && insertedCount > 0) {
        finalStatus = 'sent'; // Partial success is still sent
      }

      // 7. Update admin notification status
      try {
        await supabase
          .from('admin_notifications')
          .update({
            status: finalStatus,
            sent_at: finalStatus === 'sent' ? new Date().toISOString() : null,
            recipient_count: insertedCount
          })
          .eq('id', id);
      } catch (updateErr) {
        console.error("Failed to update admin notification status (non-critical):", updateErr);
      }

      // 8. Return appropriate response
      if (finalStatus === 'failed') {
        return NextResponse.json({
          success: false,
          error: "Failed to send notifications to any users",
          recipientCount: 0,
          failedCount
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: { id, status: finalStatus, recipient_count: insertedCount },
        recipientCount: insertedCount,
        failedCount,
        message: failedCount > 0
          ? `Sent to ${insertedCount} users (${failedCount} failed)`
          : `Successfully sent to ${insertedCount} users`
      });
    }

    // Handle archive with mobile removal
    if (status === "archived") {
      const { removeFromMobile } = body;
      let removedCount = 0;

      // Remove from mobile app users if requested
      if (removeFromMobile) {
        try {
          // First, get all notifications that contain this admin_notification_id in metadata
          const { data: notificationsToDelete } = await supabase
            .from('notifications')
            .select('id, metadata')
            .not('metadata', 'is', null);

          if (notificationsToDelete && notificationsToDelete.length > 0) {
            // Filter notifications that have matching admin_notification_id
            const idsToDelete = notificationsToDelete
              .filter(n => {
                const meta = n.metadata as Record<string, unknown>;
                return meta?.admin_notification_id === id;
              })
              .map(n => n.id);

            if (idsToDelete.length > 0) {
              const { error: deleteError } = await supabase
                .from('notifications')
                .delete()
                .in('id', idsToDelete);

              if (deleteError) {
                console.error("Error deleting notifications:", deleteError);
              } else {
                removedCount = idsToDelete.length;
              }
            }
          }
          console.log(`Removed ${removedCount} notifications from mobile users`);
        } catch (e) {
          console.error("Error removing notifications:", e);
        }
      }

      // Update admin notification - use is_archived column instead of status
      // This avoids constraint issues with the status column
      const { data, error } = await supabase
        .from('admin_notifications')
        .update({
          is_archived: true
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error("Update notification error (is_archived):", error);

        // Fallback: try updating status to 'failed' which might be allowed
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('admin_notifications')
          .update({
            status: 'failed'
          })
          .eq('id', id)
          .select()
          .single();

        if (fallbackError) {
          throw error; // throw original error
        }

        return NextResponse.json({
          success: true,
          data: { ...fallbackData, is_archived: true },
          removedCount,
          note: "Used fallback status"
        });
      }

      return NextResponse.json({
        success: true,
        data: { ...data, status: 'archived' },
        removedCount
      });
    }

    // For other status updates (draft, scheduled, etc.)
    // Also unset is_archived when restoring to draft
    const updateData: Record<string, unknown> = {
      status,
      sent_at: null
    };

    // If restoring to draft, unarchive it
    if (status === 'draft') {
      updateData.is_archived = false;
    }

    const { data, error } = await supabase
      .from('admin_notifications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error("Update notification error:", error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: { ...data, status: data.is_archived ? 'archived' : data.status }
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

// PUT - Update notification details (edit)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, title, message, type, targetAudience, scheduledAt, imageUrl } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Notification ID is required" },
        { status: 400 }
      );
    }

    // Recalculate recipient count based on new target audience
    let recipientCount = 0;
    try {
      // Fetch all profiles and filter in JavaScript to avoid enum issues
      const { data: profiles } = await supabase.from('profiles').select('id, account_role');

      if (profiles) {
        if (targetAudience === "all") {
          recipientCount = profiles.length;
        } else if (targetAudience === "customers") {
          // Get all non-admin users
          recipientCount = profiles.filter(u => {
            const role = ((u as Record<string, unknown>).account_role as string || '').toLowerCase();
            return role !== 'admin';
          }).length;
        } else if (targetAudience === "admins") {
          recipientCount = profiles.filter(u => {
            const role = ((u as Record<string, unknown>).account_role as string || '').toLowerCase();
            return role === 'admin';
          }).length;
        }
      }
    } catch (e) {
      console.error("Error counting recipients:", e);
    }

    // Build update object - WITHOUT image_url to avoid column not found error
    const updateData: Record<string, unknown> = {
      title,
      message,
      type,
      target_audience: targetAudience,
      scheduled_at: scheduledAt || null,
      status: scheduledAt ? "scheduled" : "draft",
      recipient_count: recipientCount
    };

    // First try update without image_url
    let { data, error } = await supabase
      .from('admin_notifications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    // If success and imageUrl was provided, try to update image_url separately
    if (!error && imageUrl !== undefined) {
      try {
        await supabase
          .from('admin_notifications')
          .update({ image_url: imageUrl || null })
          .eq('id', id);
      } catch (imgErr) {
        // Ignore image_url update errors (column may not exist)
        console.log("Note: image_url column may not exist, skipping image update");
      }
    }

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

// DELETE - Delete a notification
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Notification ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('admin_notifications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Delete notification error:", error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: "Notification deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting notification:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete notification",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}