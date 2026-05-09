import type { Metadata } from "next";
import "./globals.css";
import React from "react";

export const metadata: Metadata = {
  title: "SyncHub",
  description: "for the Next gen of achievers",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
