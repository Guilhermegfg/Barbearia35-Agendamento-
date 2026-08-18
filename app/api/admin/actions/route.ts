import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureDatabase, getRawDb } from "../../../../db/runtime";
import { appointments, blockedTimes, services, settings } from "../../../../db/schema";
import { isAdmin, unauthorized } from "../../../lib/admin-auth";
import { overlaps, parseBusinessHours, toMinutes, weekday } from "../../../lib/schedule";

type ActionPayload = Record<string, unknown> & { action?: string };

function text(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function serviceImage(value: unknown) {
  const image = typeof value === "string" ? value.trim() : "";
  if (image.length > 600_000) throw new Error("A imagem é muito grande.");
  if (image && !/^(data:image\/(jpeg|png|webp);base64,|\/images\/|https:\/\/)/i.test(image)) throw new Error("Escolha uma imagem válida.");
  return image;
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await ensureDatabase();
  const db = getDb();
  const payload = (await request.json().catch(() => ({}))) as ActionPayload;
  try {
    switch (payload.action) {
      case "createAppointment": {
        const firstName = text(payload.firstName, 40);
        const lastName = text(payload.lastName, 60);
        const whatsapp = text(payload.whatsapp, 24).replace(/\D/g, "");
        const serviceId = text(payload.serviceId, 80);
        const date = text(payload.date, 10);
        const time = text(payload.time, 5);
        if (firstName.length < 2 || lastName.length < 2 || whatsapp.length < 10 || !serviceId ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
          throw new Error("Preencha cliente, WhatsApp, serviço, data e horário corretamente.");
        }

        const [service] = await db.select().from(services).where(and(eq(services.id, serviceId), eq(services.active, true))).limit(1);
        if (!service) throw new Error("Escolha um serviço ativo.");
        const settingRows = await db.select().from(settings);
        const config = Object.fromEntries(settingRows.map((row) => [row.key, row.value]));
        const interval = parseBusinessHours(config.businessHours)[String(weekday(date))];
        const start = toMinutes(time);
        if (!interval || start < toMinutes(interval[0]) || start + service.duration > toMinutes(interval[1]) || start % 15 !== 0) {
          throw new Error("Este horário fica fora do expediente para o serviço escolhido.");
        }

        const [busy, blocks] = await Promise.all([
          db.select().from(appointments).where(and(eq(appointments.date, date), ne(appointments.status, "cancelado"))),
          db.select().from(blockedTimes).where(eq(blockedTimes.date, date)),
        ]);
        const hasConflict = blocks.some((block) => !block.time || overlaps(start, service.duration, toMinutes(block.time), 30)) ||
          busy.some((booking) => overlaps(start, service.duration, toMinutes(booking.time), booking.serviceDuration));
        if (hasConflict) throw new Error("Este horário já está reservado ou bloqueado.");

        const id = crypto.randomUUID();
        const requestId = `admin-${crypto.randomUUID()}`;
        const raw = getRawDb();
        await raw.batch([
          raw.prepare(`INSERT INTO appointments (
            id, request_id, first_name, last_name, whatsapp, service_id, service_name,
            service_duration, date, time, total_cents, payment_type, payment_amount_cents,
            payment_status, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', 0, 'dispensado', 'confirmado')`)
            .bind(id, requestId, firstName, lastName, whatsapp, service.id, service.name, service.duration, date, time, service.priceCents),
          raw.prepare(`WITH RECURSIVE slots(slot_minute) AS (
            SELECT ? UNION ALL SELECT slot_minute + 15 FROM slots WHERE slot_minute + 15 < ?
          ) INSERT INTO schedule_claims (claim_date, slot_minute, owner_type, owner_id)
            SELECT ?, slot_minute, 'appointment', ? FROM slots`)
            .bind(start, start + service.duration, date, id),
        ]);
        break;
      }
      case "createService": {
        const name = text(payload.name, 60);
        const description = text(payload.description, 180);
        const duration = Number(payload.duration);
        const priceCents = Number(payload.priceCents);
        const image = serviceImage(payload.image);
        if (!name || !description || duration < 15 || duration > 240 || priceCents < 100) throw new Error("Preencha os dados do serviço corretamente.");
        const [maxOrder] = await db.select({ value: sql<number>`coalesce(max(${services.sortOrder}), 0)` }).from(services);
        await db.insert(services).values({ id: crypto.randomUUID(), name, description, duration, priceCents, image, sortOrder: Number(maxOrder.value) + 1, active: true });
        break;
      }
      case "updateService": {
        const id = text(payload.id, 80);
        const name = text(payload.name, 60);
        const description = text(payload.description, 180);
        const duration = Number(payload.duration);
        const priceCents = Number(payload.priceCents);
        const image = serviceImage(payload.image);
        if (!id || !name || !description || duration < 15 || duration > 240 || priceCents < 100) throw new Error("Preencha os dados do serviço corretamente.");
        await db.update(services).set({ name, description, duration, priceCents, image, active: true, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(services.id, id));
        break;
      }
      case "archiveService": {
        await db.update(services).set({ active: false, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(services.id, text(payload.id, 80)));
        break;
      }
      case "confirmPayment": {
        const id = text(payload.id, 80);
        const result = await getRawDb().prepare(`UPDATE appointments
          SET status = 'confirmado',
              payment_status = CASE WHEN payment_type = 'full' THEN 'pago' ELSE 'sinal_pago' END,
              expires_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'aguardando_pagamento' AND expires_at > CURRENT_TIMESTAMP`).bind(id).run();
        if (!result.meta.changes) throw new Error("Esta reserva expirou ou já foi confirmada.");
        break;
      }
      case "appointmentStatus": {
        const status = text(payload.status, 20);
        if (!["confirmado", "concluido", "cancelado"].includes(status)) throw new Error("Status inválido.");
        const id = text(payload.id, 80);
        if (status === "cancelado") {
          const raw = getRawDb();
          await raw.batch([
            raw.prepare("UPDATE appointments SET status = 'cancelado', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'cancelado'").bind(id),
            raw.prepare("DELETE FROM schedule_claims WHERE owner_type = 'appointment' AND owner_id = ?").bind(id),
          ]);
        } else {
          await db.update(appointments).set({ status, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(appointments.id, id));
        }
        break;
      }
      case "paymentStatus": {
        const paymentStatus = text(payload.paymentStatus, 20);
        if (!["pendente", "sinal_pago", "pago", "dispensado"].includes(paymentStatus)) throw new Error("Status de pagamento inválido.");
        await db.update(appointments).set({ paymentStatus, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(appointments.id, text(payload.id, 80)));
        break;
      }
      case "blockSlot": {
        const date = text(payload.date, 10);
        const time = text(payload.time, 5);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error("Escolha data e horário válidos.");
        const busy = await db.select().from(appointments).where(and(eq(appointments.date, date), ne(appointments.status, "cancelado")));
        if (busy.some((item) => overlaps(toMinutes(time), 30, toMinutes(item.time), item.serviceDuration))) throw new Error("Há um cliente reservado nesse período. Cancele o agendamento antes de bloquear.");
        const id = crypto.randomUUID();
        const raw = getRawDb();
        await raw.batch([
          raw.prepare("INSERT INTO blocked_times (id, date, time, reason) VALUES (?, ?, ?, ?)").bind(id, date, time, text(payload.reason, 100) || "Bloqueado pela equipe"),
          raw.prepare(`WITH RECURSIVE slots(slot_minute) AS (
            SELECT ? UNION ALL SELECT slot_minute + 15 FROM slots WHERE slot_minute + 15 < ?
          ) INSERT INTO schedule_claims (claim_date, slot_minute, owner_type, owner_id)
            SELECT ?, slot_minute, 'block', ? FROM slots`).bind(toMinutes(time), toMinutes(time) + 30, date, id),
        ]);
        break;
      }
      case "blockDay": {
        const date = text(payload.date, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Escolha uma data válida.");
        const [busy] = await db.select().from(appointments).where(and(eq(appointments.date, date), ne(appointments.status, "cancelado"))).limit(1);
        if (busy) throw new Error("Há clientes reservados neste dia. Cancele os agendamentos antes de bloquear.");
        const id = crypto.randomUUID();
        const raw = getRawDb();
        await raw.batch([
          raw.prepare("INSERT INTO blocked_times (id, date, time, reason) VALUES (?, ?, '', ?)").bind(id, date, text(payload.reason, 100) || "Dia bloqueado pela equipe"),
          raw.prepare(`WITH RECURSIVE slots(slot_minute) AS (
            SELECT 0 UNION ALL SELECT slot_minute + 15 FROM slots WHERE slot_minute + 15 < 1440
          ) INSERT INTO schedule_claims (claim_date, slot_minute, owner_type, owner_id)
            SELECT ?, slot_minute, 'block', ? FROM slots`).bind(date, id),
        ]);
        break;
      }
      case "unblock": {
        const id = text(payload.id, 80);
        const raw = getRawDb();
        await raw.batch([
          raw.prepare("DELETE FROM schedule_claims WHERE owner_type = 'block' AND owner_id = ?").bind(id),
          raw.prepare("DELETE FROM blocked_times WHERE id = ?").bind(id),
        ]);
        break;
      }
      case "updatePayment": {
        const depositPercent = Math.round(Number(payload.depositPercent));
        const pixKey = text(payload.pixKey, 120);
        if (depositPercent < 1 || depositPercent > 100 || !pixKey) throw new Error("Informe percentual e chave PIX válidos.");
        await db.insert(settings).values({ key: "depositPercent", value: String(depositPercent) }).onConflictDoUpdate({ target: settings.key, set: { value: String(depositPercent), updatedAt: sql`CURRENT_TIMESTAMP` } });
        await db.insert(settings).values({ key: "pixKey", value: pixKey }).onConflictDoUpdate({ target: settings.key, set: { value: pixKey, updatedAt: sql`CURRENT_TIMESTAMP` } });
        break;
      }
      default:
        throw new Error("Ação não reconhecida.");
    }
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar a alteração.";
    const conflict = /UNIQUE|constraint/i.test(message);
    return Response.json({ error: conflict ? "Este horário já está reservado ou bloqueado." : message }, { status: conflict ? 409 : 400 });
  }
}
