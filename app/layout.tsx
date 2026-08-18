import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const description = "Cabelo, barba e acabamento impecável com hora marcada. Tradição no corte e respeito pelo seu tempo.";
  const socialImage = new URL("/og.png", metadataBase).toString();
  return {
    metadataBase,
    title: {
      default: "Barbearia 35 | Tradição no corte",
      template: "%s | Barbearia 35",
    },
    description,
    applicationName: "Barbearia 35",
    icons: {
      icon: "/images/logo-barbearia-35.png",
      shortcut: "/images/logo-barbearia-35.png",
      apple: "/images/logo-barbearia-35.png",
    },
    alternates: { canonical: "/" },
    category: "business",
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: "Barbearia 35",
      title: "Barbearia 35 | Tradição no corte",
      description,
      images: [{ url: socialImage, width: 1536, height: 904, alt: "Barbearia 35 — tradição no corte, respeito pelo seu tempo" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Barbearia 35 | Tradição no corte",
      description,
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
