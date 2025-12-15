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

      console.log("checkRole:", checkRole);

      if (!checkRole || checkRole.account_role == "user") {
        throw new Error("Unauthorized: You do not have access to this app.");
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log("Login error:", error);

      if (error) throw error;
      location.reload();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {/* Main Card */}
      <div className="bg-[#1a1a1a] border border-[#d4af37]/20 rounded-lg shadow-2xl overflow-hidden">
        {/* Header with Gold Accent */}
        <div className="bg-gradient-to-r from-[#d4af37]/10 to-transparent p-8 border-b border-[#d4af37]/20">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-[#d4af37] rounded-full flex items-center justify-center shadow-lg shadow-[#d4af37]/20">
              <Sparkles className="w-8 h-8 text-[#0a0a0a]" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center text-[#d4af37] mb-2 tracking-wide uppercase">
            Admin Login
          </h1>
          <p className="text-center text-[#b8a070] text-sm">
            Enter your credentials to access the admin dashboard
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="p-8 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-400/30 text-red-400 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-[#d4af37] uppercase tracking-wide"
            >
              Email Address
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#b8a070]">
                <Mail className="w-5 h-5" />
              </div>
              <input
                id="email"
                type="email"
                placeholder="admin@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-[#0a0a0a] border border-[#d4af37]/20 rounded-lg text-[#f5e6d3] placeholder-[#b8a070]/50 focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[#d4af37] uppercase tracking-wide"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#b8a070]">
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-3 bg-[#0a0a0a] border border-[#d4af37]/20 rounded-lg text-[#f5e6d3] placeholder-[#b8a070]/50 focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#b8a070] hover:text-[#d4af37] transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                className="w-4 h-4 accent-[#d4af37] rounded border-[#d4af37]/20"
              />
              <span className="ml-2 text-sm text-[#f5e6d3] group-hover:text-[#d4af37] transition-colors">
                Remember me
              </span>
            </label>
            {/* <Link
              href="/auth/forgot-password"
              className="text-sm text-[#d4af37] hover:text-[#d4af37]/80 transition-colors"
            >
              Forgot password?
            </Link> */}
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#d4af37] text-[#0a0a0a] py-3 rounded-lg font-semibold uppercase tracking-wider hover:bg-[#d4af37]/90 focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:ring-offset-2 focus:ring-offset-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#d4af37]/20"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-[#0a0a0a] border-t-transparent rounded-full animate-spin"></div>
                <span>Logging in...</span>
              </div>
            ) : (
              "Login"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="px-8 py-6 bg-[#0a0a0a] border-t border-[#d4af37]/20">
          <p className="text-center text-sm text-[#b8a070]">
            Need help?{" "}
            <a
              href="#"
              className="text-[#d4af37] hover:text-[#d4af37]/80 transition-colors font-medium"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>

      {/* Back to Home Button */}
      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#b8a070] hover:text-[#d4af37] transition-colors group"
        >
          <svg
            className="w-4 h-4 group-hover:-translate-x-1 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to home
        </Link>
      </div>

      {/* Bottom Info */}
      <p className="text-center text-xs text-[#b8a070] mt-4">
        © 2025 Scentopia Admin. All rights reserved.
      </p>
    </div>
  );
}