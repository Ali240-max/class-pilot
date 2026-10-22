import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorker } from "@/components/shell/service-worker";
import { getTheme } from "@/lib/preferences";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "ClassPilot", template: "%s · ClassPilot" },
  description: "Class management for CRs and GRs: students, deadlines, attendance, materials and an AI assistant.",
  applicationName: "ClassPilot",
  appleWebApp: { capable: true, title: "ClassPilot", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/192", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/icons/180", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

const LIGHT_BG = "#f0eef6";
const DARK_BG = "#0f0c17";

export async function generateViewport(): Promise<Viewport> {
  const theme = await getTheme();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    // Browser/status bar colour matches the chosen theme (or the device's).
    themeColor:
      theme === "system"
        ? [
            { media: "(prefers-color-scheme: light)", color: LIGHT_BG },
            { media: "(prefers-color-scheme: dark)", color: DARK_BG },
          ]
        : theme === "dark"
          ? DARK_BG
          : LIGHT_BG,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read on the server so the page renders in the right theme with no flash.
  const theme = await getTheme();
  return (
    <html
      lang="en"
      data-theme={theme === "system" ? undefined : theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
