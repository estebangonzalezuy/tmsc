import type { Metadata } from "next";
import { Archivo, Archivo_Narrow, Lora, Pirata_One } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { site } from "@/lib/data";

/* The public site is set in Archivo Narrow — one condensed grotesque for
   display and body, loaded at the weights the brutalist scale actually uses.
   Archivo and Lora stay on the page because the Posts Studio and Frames still
   draw with them; they are not the site's voice anymore. */
const archivoNarrow = Archivo_Narrow({
  variable: "--font-archivo-narrow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  style: ["normal", "italic"],
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
      className={`${archivoNarrow.variable} ${archivo.variable} ${lora.variable} ${pirata.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
