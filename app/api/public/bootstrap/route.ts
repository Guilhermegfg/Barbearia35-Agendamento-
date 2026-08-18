import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureDatabase } from "../../../../db/runtime";
import { services, settings } from "../../../../db/schema";

export async function GET() {
  try {
    await ensureDatabase();
    const db = getDb();
    const [serviceRows, settingRows] = await Promise.all([
      db.select().from(services).where(eq(services.active, true)).orderBy(asc(services.sortOrder)),
      db.select().from(settings),
    ]);
    return Response.json({
      services: serviceRows,
      settings: Object.fromEntries(settingRows.map((row) => [row.key, row.value])),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível carregar os dados." }, { status: 500 });
  }
}
