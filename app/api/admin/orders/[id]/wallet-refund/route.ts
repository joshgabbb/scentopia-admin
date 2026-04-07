// POST /api/admin/orders/[id]/wallet-refund
// Manually triggers a wallet credit for an already-cancelled wallet-paid order.
// Safe to call multiple times — checks cancelled_orders.refund_status to prevent duplicates.
import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminClient();
  const { id: orderId } = await context.params;

  try {
    // 1. Verify order is cancelled
    const { data: order } = await supabase
      .from('orders')
      .select('order_status')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    if (order.order_status !== 'Cancelled') {
      return NextResponse.json({ success: false, error: 'Order is not cancelled' }, { status: 400 });
    }

    // 2. Check refund_status to prevent double-refunds
    const { data: cancelledOrder } = await supabase
      .from('cancelled_orders')
      .select('refund_status')
      .eq('order_id', orderId)
      .maybeSingle();

    if (cancelledOrder?.refund_status === 'Refunded') {
      return NextResponse.json({ success: false, error: 'Wallet already refunded for this order' }, { status: 400 });
    }

    // 3. Find wallet payment
    const { data: payments } = await supabase
      .from('payments')
      .select('payment_method, amount, user_id')
      .eq('order_id', orderId);

    const walletPayments = (payments ?? []).filter(
      (p: any) => p.payment_method?.toLowerCase() === 'wallet'
    );
    const walletTotal = walletPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const userId = walletPayments[0]?.user_id;

    if (walletTotal <= 0 || !userId) {
      return NextResponse.json({ success: false, error: 'No wallet payment found for this order' }, { status: 400 });
    }

    // 4. Fetch wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!wallet?.id) {
      return NextResponse.json({ success: false, error: 'Customer wallet not found' }, { status: 400 });
    }

    // 5. Create credit transaction
    const { data: txn, error: txnError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        type: 'credit',
        amount: walletTotal,
        description: 'Refund for cancelled order',
        status: 'pending',
      })
      .select('id')
      .single();

    if (txnError || !txn?.id) {
      throw txnError ?? new Error('Failed to create transaction');
    }

    // 6. Mark successful so DB trigger updates wallet balance
    await supabase
      .from('wallet_transactions')
      .update({ status: 'successful' })
      .eq('id', txn.id);

    // 7. Mark refund_status as Refunded to prevent duplicates
    await supabase
      .from('cancelled_orders')
      .update({ refund_status: 'Refunded' })
      .eq('order_id', orderId);

    return NextResponse.json({ success: true, refundedAmount: walletTotal });
  } catch (error) {
    console.error('[wallet-refund] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
