import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-sm border border-[#e8e0d0] bg-white px-3 py-1 text-sm text-[#1c1810] shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#1c1810] placeholder:text-[#b0a080] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/40 focus-visible:border-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
