import type { Metadata } from "next";

import { Toaster } from "@/components/ui/sonner";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "AgentOS | OpenClaw Mission Control",
  description: "Human Control Layer for AI Agents and Companies | Built on OpenClaw.",
  applicationName: "OpenClaw Mission Control",
  themeColor: "#09101c",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        {children}
        <Toaster theme="dark" richColors closeButton />
      </body>
    </html>
  );
}
