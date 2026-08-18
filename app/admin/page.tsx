import type { Metadata } from "next";
import { AdminPage } from "../components/AdminPage";

export const metadata: Metadata = {
  title: "Painel administrativo | Barbearia 35",
  description: "Gestão de agenda, serviços e pagamentos da Barbearia 35.",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <AdminPage />;
}
