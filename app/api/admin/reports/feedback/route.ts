// app/api/admin/reports/feedback/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';
    const limit = 25;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('feedback')
      .select(`
        id,
        user_id,
        subject,
        message,
        status,
        priority,
        category,
        created_at,
        updated_at,
        admin_response,
        responded_at,
        profiles!feedback_user_id_fkey(
          first_name,
          last_name,
          email
        )
      `, { count: 'exact' });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`subject.ilike.%${search}%,message.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false });
    query = query.range(offset, offset + limit - 1);

    const { data: feedback, error, count } = await query;

    if (error) throw error;

    const formattedFeedback = feedback?.map(item => {
      const profile = item.profiles as {
        first_name?: string;
        last_name?: string;
        email?: string;
      } | null;

      return {
        id: item.id,
        userId: item.user_id,
        customerName: profile 
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown User'
          : 'Unknown User',
        customerEmail: profile?.email || 'No email',
        subject: item.subject,
        message: item.message,
        status: item.status,
        priority: item.priority,
        category: item.category,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        adminResponse: item.admin_response,
        respondedAt: item.responded_at
      };
    }) || [];

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        feedback: formattedFeedback,
        totalCount: count || 0,
        totalPages,
        currentPage: page
      }
    });

  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch feedback',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const body = await request.json();
    const { id, status, adminResponse, priority } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Feedback ID is required' },
        { status: 400 }
      );
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (adminResponse) {
      updateData.admin_response = adminResponse;
      updateData.responded_at = new Date().toISOString();
      updateData.status = 'resolved';
    }

    const { data, error } = await supabase
      .from('feedback')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Feedback update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update feedback',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Feedback ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('feedback')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Feedback deleted successfully'
    });

  } catch (error) {
    console.error('Feedback deletion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete feedback',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}