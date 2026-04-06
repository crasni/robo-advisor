import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DAT.co mNAV Monitor",
  description: "Daily mNAV tracking for Strategy's Bitcoin treasury valuation.",
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
