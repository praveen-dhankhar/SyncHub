import type { Metadata } from "next";
import { Montserrat, Playfair_Display, Source_Code_Pro } from "next/font/google";
import "./globals.css";
import React from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "SyncHub",
  description: "Secure real-time video meetings, collaboration, and meeting intelligence.",
};

const bodyFont = Montserrat({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const headingFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const displayFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["700", "800", "900"],
});

const monoFont = Source_Code_Pro({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(bodyFont.variable, headingFont.variable, displayFont.variable, monoFont.variable)}
    >
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
