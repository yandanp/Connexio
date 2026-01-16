import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Connexio - Modern Terminal for Everyone",
    template: "%s | Connexio",
  },
  description:
    "Experience the next generation of terminal applications. Built with modern technologies for speed, security, and developer experience. Download now for free.",
  keywords: ["terminal", "command line", "developer tools", "Tauri", "React", "desktop app"],
  authors: [{ name: "Connexio Team" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://connexio.app",
    siteName: "Connexio",
    title: "Connexio - Modern Terminal for Everyone",
    description: "Experience the next generation of terminal applications.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Connexio - Modern Terminal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Connexio - Modern Terminal for Everyone",
    description: "Experience the next generation of terminal applications.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="relative flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
