import type { Metadata } from "next";
import { Zilla_Slab, Atkinson_Hyperlegible, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Zilla_Slab({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-display",
});

// Designed by the Braille Institute for maximum legibility for low-vision
// readers. Choosing it for body text is part of the project's argument.
const body = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Accessibility in Real Time — SPARC",
    template: "%s · Accessibility in Real Time",
  },
  description:
    "A public record of accessibility barriers at Reston Town Center and the steps SPARC's Agents of Change have taken to call for change.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="bg-mist font-body text-ink antialiased">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
