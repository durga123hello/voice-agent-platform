import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice AI Agent Platform",
  description: "Platform for real-time voice agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
