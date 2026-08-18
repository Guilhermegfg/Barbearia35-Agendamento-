import { asc, desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureDatabase } from "../../../../db/runtime";
import { appointments, blockedTimes, services, settings } from "../../../../db/schema";
import { isAdmin, unauthorized } from "../../../lib/admin-auth";

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await ensureDatabase();
  const db = getDb();
  const [appointmentRows, blockRows, serviceRows, settingRows] = await Promise.all([
    db.select().from(appointments).orderBy(desc(appointments.date), desc(appointments.time)).limit(300),
    db.select().from(blockedTimes).orderBy(asc(blockedTimes.date), asc(blockedTimes.time)).limit(300),
    db.select().from(services).orderBy(asc(services.sortOrder)),
    db.select().from(settings),
  ]);
  return Response.json({
    appointments: appointmentRows,
    blocks: blockRows,
    services: serviceRows,
    settings: Object.fromEntries(settingRows.map((row) => [row.key, row.value])),
  });
}
