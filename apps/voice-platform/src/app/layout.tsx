import type { Metadata } from "next";
import "./globals.css";
import DashboardWrapper from "./DashboardWrapper";

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
      <body>
        <DashboardWrapper>
          {children}
        </DashboardWrapper>
      </body>
    </html>
  );
}
