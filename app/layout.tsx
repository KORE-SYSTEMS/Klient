import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { prisma } from "@/lib/prisma";

const publicSans = localFont({
  src: "../public/fonts/PublicSans-VariableFont_wght.ttf",
  variable: "--font-public-sans",
  display: "swap",
});

const manrope = localFont({
  src: "../public/fonts/Manrope-VariableFont_wght.ttf",
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Klient",
  description: "Self-hosted client portal for freelancers and agencies",
  icons: {
    icon: "/favicon.png",
  },
};

function hexToHslString(hex: string): string {
  // Parse hex to rgb
  const r = parseInt(hex.substring(1, 3), 16) / 255;
  const g = parseInt(hex.substring(3, 5), 16) / 255;
  const b = parseInt(hex.substring(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const workspace = await prisma.workspace.findFirst();
  const primaryColor = workspace?.primaryColor || "#E8520A";
  const primaryHsl = hexToHslString(primaryColor);

  return (
    <html lang="de" className="dark">
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --primary: ${primaryHsl};
            --ring: ${primaryHsl};
          }
        `}} />
      </head>
      <body
        className={`${publicSans.variable} ${manrope.variable} font-sans antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
