import React from "react";

type Variant = "primary" | "ghost" | "danger" | "success";
type Size = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-bg font-bold hover:opacity-90 border border-transparent",
  ghost:
    "bg-transparent border border-border2 text-muted hover:border-accent hover:text-accent",
  danger:
    "bg-transparent border border-danger/40 text-danger hover:bg-danger/10",
  success:
    "bg-transparent border border-ok/40 text-ok hover:bg-ok/10",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export function Button({
  variant = "ghost",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center gap-1.5 rounded-md font-semibold
        transition-all duration-150 cursor-pointer disabled:opacity-40
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
