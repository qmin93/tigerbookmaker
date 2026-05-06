// app/write/_hooks/useTabState.ts
// URL search param ?tab=... ↔ active tab 양방향 동기화.
// 5 키: writing(default) · publish · extras · ops · chapters(모바일 전용)

"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

export type TabKey = "writing" | "publish" | "extras" | "ops" | "chapters";

const VALID_TABS: ReadonlyArray<TabKey> = ["writing", "publish", "extras", "ops", "chapters"];

export function isValidTabKey(value: unknown): value is TabKey {
  return typeof value === "string" && (VALID_TABS as readonly string[]).includes(value);
}

export function useTabState(): { tab: TabKey; setTab: (next: TabKey) => void } {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab");
  const tab: TabKey = isValidTabKey(raw) ? raw : "writing";

  const setTab = useCallback(
    (next: TabKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return { tab, setTab };
}
