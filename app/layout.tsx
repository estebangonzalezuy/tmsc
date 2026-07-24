import type { Metadata } from "next";
import { Archivo, Lora, Pirata_One } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/data";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

// Blackletter option for the Post Lab's title font — not part of the site's
// own design system (Archivo/Lora only), just typographic material for posts.
const pirata = Pirata_One({
  weight: "400",
  variable: "--font-pirata",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: site.title,
  description: site.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${lora.variable} ${pirata.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
