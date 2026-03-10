// app/api/admin/auth/log/route.ts
// Called by the client-side login form to record auth events in audit_logs.
// Always returns 200 — never exposes internal errors to the client.

import { NextRequest, NextResponse } from "next/server";
import { logLogin, logLoginFailed, logLogout } from "@/lib/audit-logger";

type AuthEvent = "login" | "login_failed" | "logout";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action: AuthEvent = body.action;
    const email: string = body.email ?? "";
    const userId: string = body.userId ?? "";

    switch (action) {
      case "login":
        await logLogin(userId, email, request);
        break;
      case "login_failed":
        await logLoginFailed(email, request);
        break;
      case "logout":
        await logLogout(request);
        break;
    }
  } catch {
    // Fire-and-forget — never break the calling request
  }

  return NextResponse.json({ ok: true });
}
