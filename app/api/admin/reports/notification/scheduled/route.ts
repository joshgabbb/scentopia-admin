// app/api/admin/reports/notification/scheduled/route.ts
// API to check and send scheduled notifications that are due

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Find all scheduled notifications that are due (scheduled_at <= now)
    // Also exclude any that were already sent (have sent_at set)
    const { data: dueNotifications, error: fetchError } = await supabase
      .from('admin_notifications')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .is('sent_at', null) // Only get notifications that haven't been sent
      .or('is_archived.is.null,is_archived.eq.false');

    if (fetchError) {
      console.error("Error fetching scheduled notifications:", fetchError);
      throw fetchError;
    }

    if (!dueNotifications || dueNotifications.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No scheduled notifications due",
        processed: 0
      });
    }

    console.log(`Found ${dueNotifications.length} scheduled notifications to send`);

    let processedCount = 0;
    let failedCount = 0;

    for (const notif of dueNotifications) {
      try {
        // FIRST: Set sent_at immediately to prevent duplicate processing
        // The query excludes notifications with sent_at set, so this acts as a lock
        const sentAt = new Date().toISOString();
        const { data: lockData, error: lockError } = await supabase
          .from('admin_notifications')
          .update({ sent_at: sentAt })
          .eq('id', notif.id)
          .is('sent_at', null) // Only update if sent_at is still null
          .select();

        if (lockError) {
          console.error(`❌ Failed to lock notification ${notif.id}:`, lockError);
          continue; // Skip this notification
        }

        // If no rows were updated, another process already claimed this notification
        if (!lockData || lockData.length === 0) {
          console.log(`⏭️ Notification ${notif.id} already processed, skipping`);
          continue;
        }

        console.log(`🔒 Processing scheduled notification "${notif.title}"`);

        // Get target users based on audience
        let users: { id: string }[] = [];

        if (notif.target_audience === 'admins') {
          const { data } = await supabase
            .from('profiles')
            .select('id, account_role');

          if (data) {
            users = data.filter(u => {
              const role = ((u as { account_role?: string }).account_role || '').toLowerCase();
              return role === 'admin';
            });
          }
        } else {
          const { data } = await supabase
            .from('profiles')
            .select('id, account_role');

          if (data) {
            if (notif.target_audience === 'customers') {
              users = data.filter(u => {
                const role = ((u as { account_role?: string }).account_role || '').toLowerCase();
                return role !== 'admin';
              });
            } else {
              users = data;
            }
          }
        }

        if (users.length === 0) {
          // Mark as failed - no users
          await supabase
            .from('admin_notifications')
            .update({ status: 'failed', recipient_count: 0 })
            .eq('id', notif.id);
          failedCount++;
          continue;
        }

        // Map notification type
        let notifType = 'general';
        if (notif.type === 'promotion') notifType = 'promotion';
        else if (notif.type === 'alert') notifType = 'warning';
        else if (notif.type === 'update' || notif.type === 'newsletter') notifType = 'information';

        // Send to each user
        let insertedCount = 0;
        for (const user of users) {
          // Build insert object - only include image_url if it exists
          const insertData: Record<string, unknown> = {
            user_id: user.id,
            notification_type: notifType,
            title: notif.title,
            body: notif.message,
            is_read: false,
            metadata: {
              admin_notification_id: notif.id,
              type: notif.type,
              action: 'promotion-redirect'
            }
          };

          // Add image_url if available
          if (notif.image_url) {
            insertData.image_url = notif.image_url;
            (insertData.metadata as Record<string, unknown>).image_url = notif.image_url;
          }

          const { error: insertError } = await supabase
            .from('notifications')
            .insert(insertData);

          if (!insertError) {
            insertedCount++;
          }
        }

        // Update status to 'sent' and set recipient count
        if (insertedCount > 0) {
          // First try to update just status and count (simpler update that might work)
          const { error: statusError } = await supabase
            .from('admin_notifications')
            .update({
              status: 'sent',
              recipient_count: insertedCount
            })
            .eq('id', notif.id);

          if (statusError) {
            console.error(`Status update failed for ${notif.id}:`, statusError.message);
            // Even if status update fails, the sent_at is set and notifications were sent
            // Try updating just recipient_count as a fallback
            await supabase
              .from('admin_notifications')
              .update({ recipient_count: insertedCount })
              .eq('id', notif.id);
          }

          processedCount++;
          console.log(`✅ Auto-sent notification "${notif.title}" to ${insertedCount} users`);
        } else {
          // Mark as failed if no users received it
          try {
            await supabase
              .from('admin_notifications')
              .update({ status: 'failed', recipient_count: 0 })
              .eq('id', notif.id);
          } catch (e) {
            console.error(`Non-critical: Failed to update failed status:`, e);
          }

          failedCount++;
          console.log(`❌ Failed to send notification "${notif.title}" - no recipients`);
        }

      } catch (e) {
        console.error(`Error processing notification ${notif.id}:`, e);
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} notifications, ${failedCount} failed`,
      processed: processedCount,
      failed: failedCount
    });

  } catch (error) {
    console.error("Error processing scheduled notifications:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process scheduled notifications",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// GET - Check status of scheduled notifications
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: scheduled, error } = await supabase
      .from('admin_notifications')
      .select('id, title, scheduled_at, status')
      .eq('status', 'scheduled')
      .or('is_archived.is.null,is_archived.eq.false')
      .order('scheduled_at', { ascending: true });

    if (error) throw error;

    const now = new Date();
    const due = scheduled?.filter(n => new Date(n.scheduled_at) <= now) || [];
    const pending = scheduled?.filter(n => new Date(n.scheduled_at) > now) || [];

    return NextResponse.json({
      success: true,
      data: {
        due: due.length,
        pending: pending.length,
        dueNotifications: due,
        pendingNotifications: pending
      }
    });

  } catch (error) {
    console.error("Error fetching scheduled notifications:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch scheduled notifications" },
      { status: 500 }
    );
  }
}
