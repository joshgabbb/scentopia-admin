"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    // Log logout before signing out (fire-and-forget)
    fetch("/api/admin/auth/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => {});
    await supabase.auth.signOut();
    router.push("/admin");
  };

  return <Button onClick={logout}>Logout</Button>;
}
