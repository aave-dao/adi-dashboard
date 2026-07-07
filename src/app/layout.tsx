import "@/styles/globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Footer, Header } from "@/components";
import { env } from "@/env";
import { TRPCReactProvider } from "@/trpc/react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "a.DI - Dashboard",
  metadataBase: new URL(
    env.ENVIRONMENT_STAGE === "PROD"
      ? "https://adi.tools.aave.com"
      : "https://adi-preprod.tools.aave.com",
  ),
  description: "Aave Delivery Insfrastucture Monitoring Dashboard",
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "icon", url: "/favicon-32x32.png" },
    { rel: "icon", url: "/favicon-16x16.png" },
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png" },
  ],
};

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
      </head>
      <body className={`font-sans ${inter.variable} bg-brand-100`}>
        <TRPCReactProvider>
          <div className="container mx-auto flex min-h-screen flex-col pb-4 pl-4 pr-3 pt-4 sm:pt-10">
            <Header />
            <main className="flex-grow">{children}</main>
            <Footer />
          </div>
        </TRPCReactProvider>
      </body>
    </html>
  );
};

export default RootLayout;
