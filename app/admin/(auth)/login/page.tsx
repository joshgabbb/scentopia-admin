// app/admin/(auth)/login/page.tsx
import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-[#0a0a0a]">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}

// Note: You'll also need to update the LoginForm component with hardcoded colors
// If you want me to create that too, let me know!