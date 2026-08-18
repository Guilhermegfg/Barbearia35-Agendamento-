import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureDatabase, getRawDb } from "../../../../db/runtime";
import { appointments, blockedTimes, services, settings } from "../../../../db/schema";
import { overlaps, parseBusinessHours, todayInSaoPaulo, toMinutes, weekday } from "../../../lib/schedule";

type BookingPayload = {
  requestId?: string;
  firstName?: string;
  lastName?: string;
  whatsapp?: string;
  serviceId?: string;
  date?: string;
  time?: string;
  paymentType?: "deposit" | "full";
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as BookingPayload;
    const firstName = payload.firstName?.trim() || "";
    const lastName = payload.lastName?.trim() || "";
    const whatsapp = (payload.whatsapp || "").replace(/\D/g, "");
    const requestId = payload.requestId?.trim() || "";
    const date = payload.date || "";
    const time = payload.time || "";
    if (firstName.length < 2 || lastName.length < 2 || whatsapp.length < 10 || !payload.serviceId ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) ||
        !["deposit", "full"].includes(payload.paymentType || "") || requestId.length < 8) {
      return Response.json({ error: "Revise seus dados antes de confirmar." }, { status: 400 });
    }
    if (date < todayInSaoPaulo()) return Response.json({ error: "Escolha uma data futura." }, { status: 400 });

    await ensureDatabase();
    const db = getDb();
    const [existingRequest] = await db.select().from(appointments).where(eq(appointments.requestId, requestId)).limit(1);
    if (existingRequest) return Response.json({ booking: existingRequest, duplicate: true });

    const [service] = await db.select().from(services).where(and(eq(services.id, payload.serviceId), eq(services.active, true))).limit(1);
    if (!service) return Response.json({ error: "Este serviço não está mais disponível. Atualize a página." }, { status: 409 });

    const settingRows = await db.select().from(settings);
    const config = Object.fromEntries(settingRows.map((row) => [row.key, row.value]));
    const hours = parseBusinessHours(config.businessHours);
    const interval = hours[String(weekday(date))];
    const start = toMinutes(time);
    if (!interval || start < toMinutes(interval[0]) || start + service.duration > toMinutes(interval[1]) || start % 15 !== 0) {
      return Response.json({ error: "Este horário fica fora do expediente." }, { status: 409 });
    }

    const [busy, blocks] = await Promise.all([
      db.select().from(appointments).where(and(eq(appointments.date, date), ne(appointments.status, "cancelado"))),
      db.select().from(blockedTimes).where(eq(blockedTimes.date, date)),
    ]);
    const hasConflict = blocks.some((block) => !block.time || overlaps(start, service.duration, toMinutes(block.time), 30)) ||
      busy.some((booking) => overlaps(start, service.duration, toMinutes(booking.time), booking.serviceDuration));
    if (hasConflict) return Response.json({ error: "Esse horário acabou de ficar indisponível. Escolha outro." }, { status: 409 });

    const depositPercent = Math.min(100, Math.max(1, Number(config.depositPercent) || 30));
    const paymentAmountCents = payload.paymentType === "full"
      ? service.priceCents
      : Math.round((service.priceCents * depositPercent) / 100);
    const id = crypto.randomUUID();
    const raw = getRawDb();
    await raw.batch([
      raw.prepare(`INSERT INTO appointments (
        id, request_id, first_name, last_name, whatsapp, service_id, service_name,
        service_duration, date, time, total_cents, payment_type, payment_amount_cents,
        payment_status, status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', 'aguardando_pagamento', datetime('now', '+15 minutes'))`)
        .bind(id, requestId, firstName, lastName, whatsapp, service.id, service.name, service.duration, date, time, service.priceCents, payload.paymentType, paymentAmountCents),
      raw.prepare(`WITH RECURSIVE slots(slot_minute) AS (
        SELECT ? UNION ALL SELECT slot_minute + 15 FROM slots WHERE slot_minute + 15 < ?
      ) INSERT INTO schedule_claims (claim_date, slot_minute, owner_type, owner_id)
        SELECT ?, slot_minute, 'appointment', ? FROM slots`)
        .bind(start, start + service.duration, date, id),
    ]);
    const [booking] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
    return Response.json({ booking, depositPercent, pixKey: config.pixKey || "" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível concluir o agendamento.";
    const conflict = /UNIQUE|constraint/i.test(message);
    return Response.json({ error: conflict ? "Esse horário acabou de ficar indisponível. Escolha outro." : message }, { status: conflict ? 409 : 500 });
  }
}
