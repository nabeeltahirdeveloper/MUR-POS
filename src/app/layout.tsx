import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moon Traders | General Order Supplier",
  description: "Your Trust, Our Promise. Professional General Order Supplier services.",
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
    <html lang="en">
      <body
        className={`antialiased`}
      ><Providers>{children}</Providers>
      </body>
    </html >
  );
}
