import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Immuvi Command Center",
  description: "Creative pipeline command center for Immuvi"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
