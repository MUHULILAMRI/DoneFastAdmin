import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { PusherProvider } from "@/components/providers/PusherProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DoneFast - Sistem Distribusi Order Otomatis",
  description: "Platform distribusi order joki otomatis real-time — Joki Cepat Anti Repot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950`}
      >
        <AuthProvider>
          <PusherProvider>
            {children}
          </PusherProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
