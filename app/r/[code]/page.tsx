"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ReferralLanding() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  useEffect(() => {
    if (params?.code) {
      try {
        localStorage.setItem("tigerbookmaker_ref_code", params.code);
        document.cookie = `tigerbookmaker_ref_code=${params.code}; path=/; max-age=2592000; SameSite=Lax`;
      } catch {}
    }
    router.replace("/login?ref=" + (params?.code ?? ""));
  }, [params, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fafafa]">
      <div className="text-center">
        <div className="text-4xl mb-3">🎁</div>
        <div className="text-lg font-bold text-ink-900">추천 코드 적용 중...</div>
        <div className="text-sm text-gray-500 mt-2">잠시만 기다려주세요.</div>
      </div>
    </main>
  );
}
