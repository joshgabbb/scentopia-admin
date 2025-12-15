import { AuthButton } from "@/components/auth-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#f5e6d3] relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#d4af37]/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#d4af37]/5 rounded-full blur-3xl"></div>
      </div>

      {/* Navbar */}
      <nav className="relative w-full border-b border-[#d4af37]/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="group">
            <h1 className="text-2xl font-bold tracking-[0.3em] text-[#d4af37] hover:text-[#d4af37]/80 transition-colors">
              SCENTOPIA
            </h1>
          </Link>
          {!hasEnvVars ? <EnvVarWarning /> : <AuthButton />}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8 animate-fadeIn">
            <div className="space-y-4">
              <div className="inline-block">
                <span className="text-xs md:text-sm tracking-[0.3em] text-[#d4af37]/70 uppercase">
                  Premium Fragrance Management
                </span>
              </div>
              
              <h2 className="text-5xl md:text-7xl font-bold leading-tight">
                <span className="block text-[#f5e6d3]">Elevate Your</span>
                <span className="block text-[#d4af37] mt-2">Perfume Empire</span>
              </h2>

              <div className="h-1 w-24 bg-gradient-to-r from-[#d4af37] to-[#d4af37]/30"></div>
            </div>

            <p className="text-lg md:text-xl text-[#b8a070] leading-relaxed max-w-xl">
              Scentopia Admin is the sophisticated admin platform powering{" "}
              <span className="text-[#d4af37] font-semibold">MBT Perfume Boutique</span> – 
              where luxury meets precision. Manage your inventory of inspired fragrances 
              with the elegance they deserve.
            </p>

            <div className="space-y-4 pt-4">
              <div className="flex items-start gap-3 group">
                <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37] mt-2 group-hover:scale-150 transition-transform"></div>
                <p className="text-[#b8a070]">
                  <span className="text-[#f5e6d3] font-medium">Real-time Inventory Tracking</span> – 
                  Monitor every bottle, every scent, every sale
                </p>
              </div>
              
              <div className="flex items-start gap-3 group">
                <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37] mt-2 group-hover:scale-150 transition-transform"></div>
                <p className="text-[#b8a070]">
                  <span className="text-[#f5e6d3] font-medium">Sales Analytics Dashboard</span> – 
                  Insights as refined as your fragrances
                </p>
              </div>
              
              <div className="flex items-start gap-3 group">
                <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37] mt-2 group-hover:scale-150 transition-transform"></div>
                <p className="text-[#b8a070]">
                  <span className="text-[#f5e6d3] font-medium">Inspired Collections</span> – 
                  Manage premium scents inspired by world-renowned perfumes
                </p>
              </div>
            </div>

            <div className="pt-8">
              <Link 
                href="/admin" 
                className="inline-flex items-center gap-3 px-8 py-4 bg-[#d4af37] text-[#0a0a0a] font-semibold tracking-wider hover:bg-[#d4af37]/90 transition-all hover:gap-5 group"
              >
                ENTER DASHBOARD
                <svg 
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Right Decorative Section */}
          <div className="relative hidden md:block">
            <div className="relative aspect-square">
              {/* Decorative circles */}
              <div className="absolute inset-0 animate-spin-slow">
                <div className="absolute top-0 left-1/2 w-2 h-2 -ml-1 bg-[#d4af37] rounded-full"></div>
                <div className="absolute bottom-0 left-1/2 w-2 h-2 -ml-1 bg-[#d4af37]/50 rounded-full"></div>
                <div className="absolute left-0 top-1/2 w-2 h-2 -mt-1 bg-[#d4af37]/30 rounded-full"></div>
                <div className="absolute right-0 top-1/2 w-2 h-2 -mt-1 bg-[#d4af37]/70 rounded-full"></div>
              </div>

              {/* Center perfume bottle silhouette */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  {/* Bottle outline */}
                  <div className="w-32 h-48 border-2 border-[#d4af37]/40 relative">
                    <div className="absolute -top-6 left-1/2 -ml-8 w-16 h-8 border-2 border-[#d4af37]/40 border-b-0"></div>
                    <div className="absolute -top-10 left-1/2 -ml-4 w-8 h-6 border-2 border-[#d4af37]/40 border-b-0"></div>
                  </div>
                  
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-[#d4af37]/10 blur-xl"></div>
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute top-1/4 right-0 w-20 h-20 border border-[#d4af37]/20 rotate-12 animate-float"></div>
              <div className="absolute bottom-1/4 left-0 w-16 h-16 border border-[#d4af37]/30 -rotate-12 animate-float-delayed"></div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-24 pt-12 border-t border-[#d4af37]/20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center space-y-2 group hover:scale-105 transition-transform">
              <div className="text-4xl md:text-5xl font-bold text-[#d4af37]">170+</div>
              <div className="text-sm text-[#b8a070] uppercase tracking-wider">Premium Scents</div>
            </div>
            
            <div className="text-center space-y-2 group hover:scale-105 transition-transform">
              <div className="text-4xl md:text-5xl font-bold text-[#d4af37]">24/7</div>
              <div className="text-sm text-[#b8a070] uppercase tracking-wider">Live Tracking</div>
            </div>
            
            <div className="text-center space-y-2 group hover:scale-105 transition-transform">
              <div className="text-4xl md:text-5xl font-bold text-[#d4af37]">∞</div>
              <div className="text-sm text-[#b8a070] uppercase tracking-wider">Possibilities</div>
            </div>
            
            <div className="text-center space-y-2 group hover:scale-105 transition-transform">
              <div className="text-4xl md:text-5xl font-bold text-[#d4af37]">1</div>
              <div className="text-sm text-[#b8a070] uppercase tracking-wider">Elite Platform</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative border-t border-[#d4af37]/20 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-[#b8a070]">
          <p>
            © 2025 <span className="text-[#d4af37] font-semibold">MBT Perfume Boutique</span>. 
            Crafted with precision.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="https://supabase.com"
              target="_blank"
              className="hover:text-[#d4af37] transition-colors"
              rel="noreferrer"
            >
              Powered by Supabase
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}