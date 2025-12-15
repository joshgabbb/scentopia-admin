import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;

  return user ? (
    <div className="flex items-center gap-4">
      Hey, {user.email}!
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button className="rounded-none uppercase tracking-wider" asChild size="sm" variant={"outline"}>
        <Link href="/admin" className="px-4 py-2 rounded-md border-2 border-[#d4af37] text-[#d4af37] hover:bg-[#d4af37] hover:text-[#0a0a0a] transition-all">Sign in</Link>
      </Button>
      {/* <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">Sign up</Link>
      </Button> */}
    </div>
  );
}
