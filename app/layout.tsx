import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofMe",
  description:
    "Build a portable record of your contributions. Get your work verified by the organisations you contributed to. Share proof that others can check.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
