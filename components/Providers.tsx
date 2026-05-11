"use client";
import { SessionProvider } from "next-auth/react";
import { NotifyProvider } from "@/lib/ui/notify";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NotifyProvider>{children}</NotifyProvider>
    </SessionProvider>
  );
}
