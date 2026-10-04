import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AppProviders from "@/components/providers/AppProviders";
import "./globals.css";

// next/font скачивает шрифт при сборке и раздаёт его с нашего сайта —
// так быстрее, чем @import с Google Fonts в CSS.
// Inter — переменный шрифт: все веса (100–900) в одном файле, поэтому список weight не нужен.
// Со списком весов Google отдаёт ссылки вида /l/font?kit=..., на которых падает сборка Turbopack.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Global Chat",
  description: "Общение внутри школ, университетов, жилых комплексов и районов",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={inter.variable}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
