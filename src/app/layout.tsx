import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { APP_URL } from "@/lib/app-url";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Self-hosted to avoid next/font/google CI flakes when Google returns
// extensionless /l/font?kit= URLs (Next 16.2.x crash in google/loader.js).
const jakarta = localFont({
  src: "./fonts/PlusJakartaSans-Variable.woff2",
  variable: "--font-jakarta",
  display: "swap",
  weight: "400 700",
  preload: true,
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Booking Broom",
  description: "Manager dashboard for multi-site cleaning bookings",
  applicationName: "Booking Broom",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Booking Broom",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Chrome Android: resize layout when the virtual keyboard opens (helps chat UIs).
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#16A34A" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0F0D" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className={`${jakarta.variable} h-full`} suppressHydrationWarning>
        <body className="min-h-full font-sans">
          <ThemeProvider>
            <ConvexClientProvider>
              {children}
              <Toaster richColors position="top-center" closeButton />
            </ConvexClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
