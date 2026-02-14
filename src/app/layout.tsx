import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOON TRADERS | General Order Supplier",
  description: "MOON TRADERS - Your Trust, Our Promise. Professional General Order Supplier services.",
  icons: {
    icon: "/favicon.jpg",
    apple: "/favicon.jpg",
  },
};

import { Providers } from "@/components/Providers";


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
        <div className="text-center py-4 text-sm text-gray-500">
          <span>
            © {new Date().getFullYear()} JB & COMPANY. All rights reserved.
          </span>
        </div>
      </body>
    </html >
  );
}
