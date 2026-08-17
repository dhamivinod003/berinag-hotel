import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "full";
}

const sizeMap = {
  sm: "max-w-4xl",
  md: "max-w-6xl",
  lg: "max-w-7xl",
  full: "max-w-none",
};

export function Container({ children, className, size = "lg" }: ContainerProps) {
  return (
    <div className={cn("container mx-auto", sizeMap[size], className)}>
      {children}
    </div>
  );
}
