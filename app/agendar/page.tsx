import type { Metadata } from "next";
import { BookingPage } from "../components/BookingPage";

export const metadata: Metadata = {
  title: "Agendar horário | Barbearia 35",
  description: "Escolha o serviço, a data e o horário do seu próximo atendimento na Barbearia 35.",
};

export default function SchedulePage() {
  return <BookingPage />;
}
