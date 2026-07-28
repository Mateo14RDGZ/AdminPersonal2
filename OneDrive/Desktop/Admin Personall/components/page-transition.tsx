"use client";

import { usePathname } from "next/navigation";
import { AppPageTransition } from "@/components/app-motion";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return <AppPageTransition path={pathname}>{children}</AppPageTransition>;
}
