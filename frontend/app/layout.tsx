import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZeroWaste — Campus Food Intelligence",
  description: "Smart food waste tracking and demand forecasting for campus canteens. Reduce waste, save money, measure sustainability impact.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
