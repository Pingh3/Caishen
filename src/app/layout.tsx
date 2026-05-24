import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { APP_NAME } from "@/lib/app";
import { ThemeProvider, ThemeScript } from "@/components/ThemeProvider";
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
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: "Track net worth, CPF, investments, and trading journal in SGD",
  applicationName: APP_NAME,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans`}
      >
        <ThemeProvider>
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-12 pt-6 sm:px-6">
            <Nav />
            <main className="mt-8 flex-1">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
