import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PT 예약",
  description: "PT 예약 SaaS — Phase 1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
