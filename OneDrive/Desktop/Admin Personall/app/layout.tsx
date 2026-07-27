import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PendingSync } from "@/components/pending-sync";

export const metadata: Metadata = {
  title: "LaPesadilla Finanzas",
  description: "Administración personal de gastos",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LaPesadilla Finanzas",
  },
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0d111c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="screen-height">
        <PendingSync />
        {children}
      </body>
    </html>
  );
}
