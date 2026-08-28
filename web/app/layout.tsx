import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DISCOVA",
  description: "Website Visibility Intelligence — powered by lean.X digital",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
