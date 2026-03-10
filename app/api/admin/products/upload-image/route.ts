import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. User not found." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const bucket = (formData.get("bucket") as string) || "products";

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Only JPEG, PNG, and WebP are allowed." },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File size too large. Maximum 5MB allowed." },
        { status: 400 }
      );
    }

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `${user.id}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, uint8Array, {
        contentType: file.type,
        cacheControl: "3600",
      });

    if (error) {
      console.error("Storage upload error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to upload image to storage" },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
      filename: fileName,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. User not found." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path");
    const bucket = searchParams.get("bucket") || "products";

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: "File path is required" },
        { status: 400 }
      );
    }

    if (!filePath.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { success: false, error: "You can only delete your own files." },
        { status: 403 }
      );
    }

    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) {
      console.error("Storage delete error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete image from storage" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
