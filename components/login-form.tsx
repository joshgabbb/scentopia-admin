"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Sparkles, Mail, Lock } from "lucide-react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const logAuthEvent = (action: "login" | "login_failed", userId = "", emailVal = email) => {
    // Fire-and-forget — do not await, never block the UX
    fetch("/api/admin/auth/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, email: emailVal, userId }),
    }).catch(() => {});
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      if (email.trim() === "") {
        throw new Error("Email is required");
      }

      const { data: checkRole } = await supabase
        .from("profiles")
        .select("account_role")
        .eq("email", email)
        .single();

      if (!checkRole || checkRole.account_role == "user") {
        logAuthEvent("login_failed");
        throw new Error("Unauthorized: You do not have access to this app.");
      }

      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logAuthEvent("login_failed");
        throw error;
      }

      // Log successful login (fire-and-forget)
      logAuthEvent("login", signInData.user?.id ?? "");
      location.reload();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-5", className)} {...props}>
      {/* Main Card */}
      <div className="bg-white border border-[#e8e0d0] rounded-sm shadow-xl shadow-[#D4AF37]/6 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#D4AF37]/8 to-transparent p-8 border-b border-[#e8e0d0]">
          <div className="flex items-center justify-center mb-5">
            <div className="w-14 h-14 bg-[#D4AF37] rounded-sm flex items-center justify-center shadow-lg shadow-[#D4AF37]/30">
              <Sparkles className="w-7 h-7 text-[#1c1810]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-[#1c1810] mb-1.5 tracking-wider uppercase">
            Admin Login
          </h1>
          <p className="text-center text-[#7a6a4a] text-sm">
            Enter your credentials to access the dashboard
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="p-8 space-y-5">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-sm text-sm flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-xs font-bold text-[#7a6a4a] uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8a6a]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="email"
                type="email"
                placeholder="admin@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-[#e8e0d0] rounded-sm text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] transition-all text-sm"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-xs font-bold text-[#7a6a4a] uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8a6a]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-white border border-[#e8e0d0] rounded-sm text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] transition-all text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8a6a] hover:text-[#8B6914] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center justify-between">
            <label className="flex items-center cursor-pointer group gap-2">
              <input type="checkbox" className="w-4 h-4 accent-[#D4AF37] rounded border-[#e8e0d0]" />
              <span className="text-sm text-[#7a6a4a] group-hover:text-[#8B6914] transition-colors">
                Remember me
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#D4AF37] text-[#1c1810] py-3 rounded-sm font-bold uppercase tracking-wider text-sm hover:bg-[#C4A030] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-[#D4AF37]/25 active:scale-[0.99]"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-[#1c1810] border-t-transparent rounded-full animate-spin" />
                <span>Logging in…</span>
              </div>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="px-8 py-5 bg-[#faf8f3] border-t border-[#e8e0d0]">
          <p className="text-center text-sm text-[#7a6a4a]">
            Need help?{" "}
            <a href="#" className="text-[#8B6914] hover:text-[#D4AF37] transition-colors font-semibold">
              Contact Support
            </a>
          </p>
        </div>
      </div>

      {/* Back to Home */}
      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#7a6a4a] hover:text-[#8B6914] transition-colors group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to home
        </Link>
      </div>

      <p className="text-center text-xs text-[#9a8a6a]">
        © 2025 Scentopia Admin. All rights reserved.
      </p>
    </div>
  );
}
