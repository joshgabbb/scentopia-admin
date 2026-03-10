import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

// Required: Export a function named "proxy" (named export)
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// Keep your matcher config exactly as it was
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};