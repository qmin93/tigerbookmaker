// robots.txt — Next.js 14 metadata-routes 표준
// DEFER 페이지 (spec v3 — 사용자 풀 누적 후 활성화)는 크롤러 색인 제외.
// API · 인증 페이지 · 사용자 전용 페이지도 noindex.

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const SITE_URL = "https://tigerbookmaker.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",                  // API 라우트
          "/login",                 // 인증 페이지 (sitemap에는 있지만 색인 막음)
          "/reset-password",
          "/billing",               // 사용자 전용
          "/billing/success",
          "/billing/fail",
          "/usage",
          "/profile",
          "/projects",
          "/write",
          "/preview",
          "/export",
          "/new",
          "/r/",                    // 추천 코드 redirect
          "/share/",                // /book/와 중복
          "/u/",                    // 작가 프로필 (DEFER)
          "/challenges",            // DEFER
          "/series",                // DEFER
          "/trends",                // DEFER
          "/import-blog",           // DEFER
          "/external-publishing",   // DEFER
          "/external-linkbio",      // DEFER
          "/kmong-listing-helper",  // DEFER (publishing-package에 통합)
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
