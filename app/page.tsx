import type { Metadata } from "next";
import { LandingPage } from "./components/LandingPage";

export const metadata: Metadata = {
  title: "Barbearia 35 | Tradição no corte",
  description: "Cabelo, barba e acabamento impecável com hora marcada na Barbearia 35.",
};

export default function Home() {
  return <LandingPage />;
}
