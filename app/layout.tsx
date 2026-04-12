import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="dark">
      <body
        className={`${publicSans.variable} ${manrope.variable} font-sans antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
