import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Nav } from "@/components/Nav";
import { PrivacyProvider } from "@/components/PrivacyProvider";
import { APP_NAME } from "@/lib/app";
import { isHideAmountsEnabled, PRIVACY_COOKIE } from "@/lib/privacy";
import { ThemeProvider, ThemeScript } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: "Track net worth, CPF, investments, and trading journal in SGD",
  applicationName: APP_NAME,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hideAmounts = isHideAmountsEnabled(
    (await cookies()).get(PRIVACY_COOKIE)?.value,
  );

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen font-sans">
        <ThemeProvider>
          <PrivacyProvider initialHide={hideAmounts}>
            <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-12 pt-6 sm:px-6">
              <Nav />
              <main className="mt-8 flex-1">{children}</main>
            </div>
          </PrivacyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
