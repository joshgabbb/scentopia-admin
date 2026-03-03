// contexts/ThemeContext.tsx
"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useTheme as useNextTheme } from 'next-themes';

const lightClasses = {
  bg:           'bg-white',
  bgSecondary:  'bg-[#faf8f3]',
  bgTertiary:   'bg-[#f2ede4]',
  text:         'text-[#1c1810]',
  textMuted:    'text-[#7a6a4a]',
  textStrong:   'text-[#0d0a05]',
  accent:       'text-[#8B6914]',
  accentBg:     'bg-[#D4AF37]',
  accentText:   'text-[#1c1810]',
  border:       'border-[#e8e0d0]',
  borderStrong: 'border-[#D4AF37]/50',
  hoverBg:      'hover:bg-[#D4AF37]/10',
  inputBg:      'bg-white',
  cardBg:       'bg-[#faf8f3]',
};

const darkClasses = {
  bg:           'bg-[#100f0c]',
  bgSecondary:  'bg-[#1c1a14]',
  bgTertiary:   'bg-[#26231a]',
  text:         'text-[#f0e8d8]',
  textMuted:    'text-[#9a8a68]',
  textStrong:   'text-[#ffffff]',
  accent:       'text-[#D4AF37]',
  accentBg:     'bg-[#D4AF37]',
  accentText:   'text-[#100f0c]',
  border:       'border-[#2e2a1e]',
  borderStrong: 'border-[#D4AF37]/50',
  hoverBg:      'hover:bg-[#D4AF37]/10',
  inputBg:      'bg-[#26231a]',
  cardBg:       'bg-[#1c1a14]',
};

// Static fallback for SSR / outside-provider usage
export const themeClasses = lightClasses;

type ThemeClasses = typeof lightClasses;

interface ThemeContextType {
  themeClasses: ThemeClasses;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function ThemeContextInner({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useNextTheme();
  const isDark = resolvedTheme === 'dark';
  const classes = isDark ? darkClasses : lightClasses;

  return (
    <ThemeContext.Provider value={{ themeClasses: classes, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContextInner>{children}</ThemeContextInner>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
