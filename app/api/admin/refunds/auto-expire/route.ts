import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/refunds/auto-expire
 *
 * Triggered daily by Vercel cron (with CRON_SECRET Bearer token).
 * Auto-declines Pending refunds whose 7-day window has expired.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (isCron) {
    return await runAutoExpire();
  }

  // Non-cron call: just show pending-expiry preview
  try {
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('refunds')
      .select('id, order_id, expires_at, created_at')
      .eq('status', 'Pending')
      .not('expires_at', 'is', null)
      .lt('expires_at', now);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: { expired_pending_count: (data || []).length, refunds: data },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/refunds/auto-expire
 *
 * Manual trigger from admin dashboard.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!(cronSecret && authHeader === `Bearer ${cronSecret}`)) {
    const anonClient = await import('@/lib/supabase/server').then(m => m.createClient());
    const { data: { user }, error } = await (anonClient as any).auth.getUser();
    if (error || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  return await runAutoExpire();
}

async function runAutoExpire(): Promise<NextResponse> {
  try {
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // Find Pending refunds past their expiry date
    const { data: expired, error: fetchError } = await supabase
      .from('refunds')
      .select('id, order_id, user_id, amount')
      .eq('status', 'Pending')
      .not('expires_at', 'is', null)
      .lt('expires_at', now);

    if (fetchError) throw fetchError;
    if (!expired || expired.length === 0) {
      return NextResponse.json({
        success: true,
        data: { expired_count: 0 },
        message: 'No refunds to expire',
      });
    }

    let expiredCount = 0;

    for (const refund of expired) {
      try {
        await supabase
          .from('refunds')
          .update({
            status: 'Declined',
            admin_note: 'Automatically declined — refund window expired without admin action.',
            updated_at: now,
          })
          .eq('id', refund.id);

        // Notify customer (non-critical)
        try {
          await supabase.from('notifications').insert({
            user_id: refund.user_id,
            title: 'Refund Request Expired',
            body: 'Your refund request was not actioned within the 7-day window and has been automatically closed.',
            type: 'order_update',
            data: { order_id: refund.order_id, refund_id: refund.id },
          });
        } catch {
          // Non-critical
        }

        expiredCount++;
      } catch (err) {
        console.error(`Failed to expire refund ${refund.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      data: { expired_count: expiredCount },
      message: `Expired ${expiredCount} refund request(s)`,
    });
  } catch (error) {
    console.error('Auto-expire error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Auto-expire failed' },
      { status: 500 }
    );
  }
}
