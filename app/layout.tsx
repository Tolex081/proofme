import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Jost } from "next/font/google";
import "./globals.css";

const jost = Jost({ subsets: ["latin"], variable: "--font-jost", display: "swap" });
const atkinson = Atkinson_Hyperlegible_Next({
  adjustFontFallback: false,
  subsets: ["latin"],
  variable: "--font-atkinson",
  display: "swap",
});
const atkinsonMono = Atkinson_Hyperlegible_Mono({
  adjustFontFallback: false,
  subsets: ["latin"],
  variable: "--font-atkinson-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "ProofMe", template: "%s · ProofMe" },
  description:
    "Build a portable record of your contributions. Get your work verified by the organisations you contributed to. Share proof that others can check.",
};

export const viewport: Viewport = {
  themeColor: "#0f1830",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${jost.variable} ${atkinson.variable} ${atkinsonMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
