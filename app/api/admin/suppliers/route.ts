// app/api/admin/suppliers/route.ts
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = createAdminClient();
  try {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, phone, email, address, notes, is_active, created_at")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Suppliers GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch suppliers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const supabase = createAdminClient();

  try {
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, email, address, notes } = body;

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { success: false, error: "name and phone are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("suppliers")
      .insert({ name: name.trim(), phone: phone.trim(), email: email?.trim() || null, address: address?.trim() || null, notes: notes?.trim() || null, created_by: user.id })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error("Suppliers POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create supplier" },
      { status: 500 }
    );
  }
}
