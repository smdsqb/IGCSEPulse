import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "IGCSEPulse — Your IGCSE doubts, answered.",
  description:
    "A community + AI platform built for IGCSE students. Ask doubts, get mark scheme help, and connect with peers.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <meta
          name="google-adsense-account"
          content="ca-pub-3645158319821683"
        />
        <meta 
          name="google-site-verification" 
          content="S8xwMMjB-B5LIkkGjDEXCx3LsZkYE9RUBpm51QlMc8c" 
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3645158319821683"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
