import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Closet Compass — wardrobe, photos and private reflection",
  description: "Review your wardrobe, improve profile photos and create a private daily self-reflection from moments you intentionally save.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU">
      <body className="antialiased">{children}</body>
    </html>
  );
}
