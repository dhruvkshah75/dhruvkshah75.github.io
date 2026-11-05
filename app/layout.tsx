import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dhruvkshah75.github.io"),
  title: "Dhruv Shah — Software developer",
  description: "Take a walk through my corner of the internet. A pixel forest portfolio of backend systems, developer tools, and experiments by Dhruv Shah.",
  openGraph: { title: "Dhruv Shah — Software developer", description: "Backend systems, developer tools, and a walk through a pixel forest.", type: "website" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#080f0f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-type="software"><body>{children}</body></html>;
}
