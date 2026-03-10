"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ThemeSwitcher = () => {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-8 h-8" />;

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className="relative w-8 h-8 flex items-center justify-center rounded-md border border-[#e8e0d0] dark:border-[#2e2a1e] bg-white dark:bg-[#1c1a14] text-[#8B6914] dark:text-[#D4AF37] hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/8 dark:hover:bg-[#D4AF37]/10 transition-all duration-200 active:scale-95"
    >
      {isDark ? (
        <Sun size={15} strokeWidth={1.8} />
      ) : (
        <Moon size={15} strokeWidth={1.8} />
      )}
    </button>
  );
};

export { ThemeSwitcher };
