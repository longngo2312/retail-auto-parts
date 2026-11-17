import type { ReactNode } from "react";
import Header from "@/components/Header";
import { CartProvider } from "@/lib/cart";
import "./globals.css";

export const metadata = {
  title: "Retail Auto Parts",
  description: "CSCE 4350 Retail Auto Parts System — Phase III web app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <Header />
          <main>{children}</main>
        </CartProvider>
      </body>
    </html>
  );
}
