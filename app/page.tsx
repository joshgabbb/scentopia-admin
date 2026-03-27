import { AuthButton } from "@/components/auth-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Image from "next/image";
import mbtLogo from "@/public/assets/images/general/MBT.jpg";

export default function Home() {
  return (
    <main className="min-h-screen bg-white dark:bg-[#100f0c] text-[#1c1810] dark:text-[#f0e8d8] relative overflow-hidden transition-colors duration-200">
      {/* Subtle warm background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-[#D4AF37]/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-50/80 dark:bg-amber-900/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-[#D4AF37]/3 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* Sticky Navbar */}
      <nav className="relative w-full border-b border-[#e8e0d0] dark:border-[#2e2a1e] bg-white/90 dark:bg-[#100f0c]/90 backdrop-blur-sm sticky top-0 z-50 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="group flex items-center gap-3">
            <Image
              src={mbtLogo}
              alt="MBT Logo"
              className="w-9 h-9 object-contain rounded-full flex-shrink-0"
            />
            <h1 className="text-lg font-bold tracking-[0.25em] text-[#1c1810] dark:text-[#f0e8d8] group-hover:text-[#8B6914] dark:group-hover:text-[#D4AF37] transition-colors duration-200">
              SCENTOPIA
            </h1>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            {!hasEnvVars ? <EnvVarWarning /> : <AuthButton />}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-12 md:pt-28 md:pb-20">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left Content */}
          <div className="space-y-8 animate-fadeIn">
            {/* Eyebrow label */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full">
              <div className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full" />
              <span className="text-xs tracking-[0.2em] text-[#8B6914] dark:text-[#D4AF37] uppercase font-semibold">
                Premium Fragrance Management
              </span>
            </div>

            {/* Headline */}
            <div className="space-y-3">
              <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.08] tracking-tight">
                <span className="block text-[#1c1810] dark:text-[#f0e8d8]">Elevate Your</span>
                <span className="block text-[#1c1810] dark:text-[#f0e8d8] mt-1">
                  Perfume{" "}
                  <span className="text-[#8B6914] dark:text-[#D4AF37] relative">
                    Empire
                    <span className="absolute bottom-1 left-0 w-full h-0.5 bg-[#D4AF37]/40 rounded-full" />
                  </span>
                </span>
              </h2>
              <div className="flex items-center gap-2 pt-1">
                <div className="h-px w-14 bg-[#D4AF37]" />
                <div className="h-px w-6 bg-[#D4AF37]/40" />
              </div>
            </div>

            {/* Description */}
            <p className="text-base sm:text-lg text-[#7a6a4a] dark:text-[#9a8a68] leading-relaxed max-w-lg">
              The sophisticated admin platform powering{" "}
              <span className="text-[#8B6914] dark:text-[#D4AF37] font-semibold">MBT Perfume Boutique</span>.
              Manage your inspired fragrance collection with precision and elegance.
            </p>

            {/* Feature bullets */}
            <div className="space-y-3.5">
              {[
                {
                  title: "Real-time Inventory Tracking",
                  desc: "Monitor every bottle, every scent, every sale",
                },
                {
                  title: "Sales Analytics Dashboard",
                  desc: "Insights as refined as your fragrances",
                },
                {
                  title: "Inspired Collections",
                  desc: "Manage premium scents inspired by world-renowned perfumes",
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 group">
                  <div className="mt-1 w-5 h-5 rounded-full bg-[#D4AF37]/12 border border-[#D4AF37]/30 flex items-center justify-center flex-shrink-0 group-hover:bg-[#D4AF37]/22 transition-colors duration-200">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                  </div>
                  <p className="text-sm sm:text-base text-[#7a6a4a] dark:text-[#9a8a68]">
                    <span className="text-[#1c1810] dark:text-[#f0e8d8] font-semibold">{item.title}</span>
                    {" "}— {item.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-start gap-3 pt-2">
              <Link
                href="/admin"
                className="inline-flex items-center gap-3 px-7 py-3.5 bg-[#D4AF37] text-[#1c1810] font-semibold tracking-wider text-sm hover:bg-[#C4A030] transition-all duration-300 hover:shadow-lg hover:shadow-[#D4AF37]/25 group rounded-sm"
              >
                ENTER DASHBOARD
                <svg
                  className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-2 px-6 py-3.5 border border-[#e8e0d0] dark:border-[#2e2a1e] text-[#7a6a4a] dark:text-[#9a8a68] hover:border-[#D4AF37]/50 hover:text-[#8B6914] dark:hover:text-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all duration-300 text-sm font-medium rounded-sm"
              >
                Admin Login
              </Link>
            </div>
          </div>

          {/* Right Decorative Visual */}
          <div className="relative hidden md:flex items-center justify-center">
            <div className="relative w-[320px] h-[320px] lg:w-[380px] lg:h-[380px]">

              {/* Slow-spinning orbit ring */}
              <div className="absolute inset-0 animate-spin-slow">
                <div className="absolute top-0 left-1/2 w-2.5 h-2.5 -ml-1.5 bg-[#D4AF37] rounded-full shadow-sm shadow-[#D4AF37]/60" />
                <div className="absolute bottom-0 left-1/2 w-2 h-2 -ml-1 bg-[#D4AF37]/55 rounded-full" />
                <div className="absolute left-0 top-1/2 w-1.5 h-1.5 -mt-0.75 bg-[#D4AF37]/40 rounded-full" />
                <div className="absolute right-0 top-1/2 w-2 h-2 -mt-1 bg-[#D4AF37]/75 rounded-full" />
              </div>

              {/* Concentric rings */}
              <div className="absolute inset-5 rounded-full border border-[#D4AF37]/18" />
              <div className="absolute inset-10 rounded-full border border-[#D4AF37]/12" />

              {/* Central display */}
              <div className="absolute inset-14 rounded-full bg-gradient-to-br from-[#faf8f3] dark:from-[#1c1a14] to-[#f0ebe0] dark:to-[#26231a] border border-[#D4AF37]/35 shadow-2xl shadow-[#D4AF37]/12 flex items-center justify-center">
                <div className="relative flex items-center justify-center">
                  {/* Bottle shape */}
                  <div className="relative">
                    <div className="w-20 h-32 border-2 border-[#D4AF37]/70 rounded-sm bg-[#D4AF37]/6 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-b from-[#D4AF37]/15 via-transparent to-transparent" />
                      <div className="absolute top-3 left-3 right-3 h-10 border border-[#D4AF37]/25 rounded-sm" />
                      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-[#D4AF37]/10 to-transparent" />
                    </div>
                    <div className="absolute -top-5 left-1/2 -ml-[22px] w-11 h-6 border-2 border-[#D4AF37]/70 border-b-0 rounded-t-sm" />
                    <div className="absolute -top-9 left-1/2 -ml-[12px] w-6 h-5 border-2 border-[#D4AF37]/70 border-b-0 rounded-t-sm" />
                    <div className="absolute -top-11 left-1/2 -ml-[7px] w-3.5 h-3 bg-[#D4AF37]/80 rounded-t-sm" />
                    {/* Glow */}
                    <div className="absolute inset-0 bg-[#D4AF37]/8 blur-2xl scale-[2] rounded-full" />
                  </div>
                </div>
              </div>

              {/* Floating accent boxes */}
              <div className="absolute top-7 right-3 w-14 h-14 border border-[#D4AF37]/28 rounded-sm rotate-12 animate-float bg-white/60 dark:bg-[#1c1a14]/60" />
              <div className="absolute bottom-9 left-1 w-10 h-10 border border-[#D4AF37]/22 rounded-sm -rotate-12 animate-float-delayed bg-white/60 dark:bg-[#1c1a14]/60" />

              {/* Decorative sparkle marks */}
              <div className="absolute top-1 right-10 text-[#D4AF37]/35 text-3xl font-light select-none leading-none">✦</div>
              <div className="absolute bottom-5 left-10 text-[#D4AF37]/22 text-xl font-light select-none leading-none">✦</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-20 md:py-24">
        <div className="text-center mb-14">
          <p className="text-xs tracking-[0.3em] text-[#8B6914] dark:text-[#D4AF37] uppercase mb-4 font-semibold">Why Scentopia</p>
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#1c1810] dark:text-[#f0e8d8] mb-5">
            Built for Fragrance Excellence
          </h3>
          <div className="flex items-center justify-center gap-2">
            <div className="h-px w-12 bg-[#D4AF37]" />
            <div className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full" />
            <div className="h-px w-12 bg-[#D4AF37]" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 lg:gap-8">
          {[
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              ),
              title: "Inventory Management",
              desc: "Track every product, size, and stock level in real-time. Get instant alerts when inventory runs low.",
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              ),
              title: "Sales Analytics",
              desc: "Comprehensive dashboards with revenue trends, top products, and sales patterns to drive smart decisions.",
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              ),
              title: "Order Processing",
              desc: "Streamlined order management with status tracking, shipping integration, and customer communication.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="group p-7 sm:p-8 bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] rounded-sm hover:border-[#D4AF37]/45 hover:shadow-xl hover:shadow-[#D4AF37]/8 transition-all duration-300"
            >
              <div className="w-12 h-12 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-sm flex items-center justify-center mb-6 text-[#8B6914] dark:text-[#D4AF37] group-hover:bg-[#D4AF37]/20 group-hover:border-[#D4AF37]/50 transition-all duration-300">
                {feature.icon}
              </div>
              <h4 className="text-base font-bold text-[#1c1810] dark:text-[#f0e8d8] mb-2.5">{feature.title}</h4>
              <p className="text-sm text-[#7a6a4a] dark:text-[#9a8a68] leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-t border-b border-[#e8e0d0] dark:border-[#2e2a1e] bg-[#faf8f3] dark:bg-[#1c1a14] transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14 sm:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {[
              { value: "170+", label: "Premium Scents" },
              { value: "24/7", label: "Live Tracking" },
              { value: "∞", label: "Possibilities" },
              { value: "1", label: "Elite Platform" },
            ].map((stat) => (
              <div key={stat.label} className="text-center group cursor-default">
                <div className="text-4xl sm:text-5xl font-bold text-[#D4AF37] mb-2 group-hover:scale-105 transition-transform duration-300 inline-block">
                  {stat.value}
                </div>
                <div className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] uppercase tracking-[0.18em] font-semibold">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-[#e8e0d0] dark:border-[#2e2a1e] bg-white dark:bg-[#100f0c] transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-[#7a6a4a] dark:text-[#9a8a68]">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-[#D4AF37] flex items-center justify-center rounded-sm flex-shrink-0">
              <span className="text-[#1c1810] text-[10px] font-bold">S</span>
            </div>
            <p>
              © 2025{" "}
              <span className="text-[#8B6914] dark:text-[#D4AF37] font-semibold">MBT Perfume Boutique</span>.
              Crafted with precision.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#8B6914] dark:hover:text-[#D4AF37] transition-colors duration-200 text-xs"
            >
              Powered by Supabase
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
