import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureDatabase } from "../../../../db/runtime";
import { appointments, blockedTimes, services } from "../../../../db/schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || "";
  const serviceId = url.searchParams.get("serviceId") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !serviceId) {
    return Response.json({ error: "Data ou serviço inválido." }, { status: 400 });
  }
  try {
    await ensureDatabase();
    const db = getDb();
    const [service] = await db.select().from(services).where(and(eq(services.id, serviceId), eq(services.active, true))).limit(1);
    if (!service) return Response.json({ error: "Serviço indisponível." }, { status: 404 });
    const [busy, blocks] = await Promise.all([
      db.select({ time: appointments.time, duration: appointments.serviceDuration })
        .from(appointments)
        .where(and(eq(appointments.date, date), ne(appointments.status, "cancelado"))),
      db.select().from(blockedTimes).where(eq(blockedTimes.date, date)),
    ]);
    return Response.json({ busy, blocks, serviceDuration: service.duration });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível consultar a agenda." }, { status: 500 });
  }
}
