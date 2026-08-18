import { env } from "cloudflare:workers";

const defaultServices = [
  ["corte-tradicional", "Corte Tradicional", "Tesoura e máquina com acabamento preciso.", 45, 4500, "/images/services/corte-tradicional.jpg", 1],
  ["degrade-fade", "Degradê / Fade", "Transição limpa e acabamento na navalha.", 60, 5500, "/images/services/degrade-fade.jpg", 2],
  ["barba-terapia", "Barba Terapia", "Modelagem, toalha quente e hidratação.", 45, 4000, "/images/services/barba-terapia.jpg", 3],
  ["combo", "Combo Cabelo + Barba", "Visual completo em uma única visita.", 90, 8000, "/images/services/combo-cabelo-barba.jpg", 4],
  ["platinado", "Platinado", "Descoloração e tonalização com avaliação prévia.", 120, 15000, "/images/services/platinado.jpg", 5],
] as const;

export function getRawDb(): D1Database {
  const database = env.DB as D1Database | undefined;
  if (!database) throw new Error("A agenda está temporariamente indisponível.");
  return database;
}

export async function ensureDatabase() {
  const database = getRawDb();
  const configuredPixKey = typeof env.PIX_KEY === "string" ? env.PIX_KEY.trim() : "";
  const configuredWhatsapp = typeof env.WHATSAPP_NUMBER === "string" ? env.WHATSAPP_NUMBER.trim() : "";
  await database.batch([
    database.prepare(`CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      duration INTEGER NOT NULL,
      price_cents INTEGER NOT NULL,
      image TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      service_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      service_duration INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      total_cents INTEGER NOT NULL,
      payment_type TEXT NOT NULL,
      payment_amount_cents INTEGER NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pendente',
      status TEXT NOT NULL DEFAULT 'confirmado',
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS blocked_times (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      time TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT 'Bloqueado pela equipe',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS schedule_claims (
      claim_date TEXT NOT NULL,
      slot_minute INTEGER NOT NULL,
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      PRIMARY KEY (claim_date, slot_minute)
    )`),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_services_active_sort ON services(active, sort_order)"),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_request_id ON appointments(request_id)"),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_active_slot ON appointments(date, time) WHERE status != 'cancelado'"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments(date, status)"),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_date_time ON blocked_times(date, time)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_blocked_date ON blocked_times(date)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_schedule_claims_owner ON schedule_claims(owner_type, owner_id)"),
    database.prepare("PRAGMA optimize"),
  ]);

  const appointmentColumns = await database.prepare("PRAGMA table_info(appointments)").all<{ name: string }>();
  if (!appointmentColumns.results.some((column) => column.name === "expires_at")) {
    try { await database.prepare("ALTER TABLE appointments ADD COLUMN expires_at TEXT").run(); }
    catch (error) {
      if (!/duplicate column/i.test(error instanceof Error ? error.message : "")) throw error;
    }
  }

  await database.batch([
    database.prepare(`DELETE FROM schedule_claims WHERE owner_type = 'appointment' AND owner_id IN (
      SELECT id FROM appointments WHERE status = 'aguardando_pagamento' AND expires_at <= CURRENT_TIMESTAMP
    )`),
    database.prepare(`UPDATE appointments SET status = 'cancelado', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'aguardando_pagamento' AND expires_at <= CURRENT_TIMESTAMP`),
  ]);

  const serviceCount = await database.prepare("SELECT COUNT(*) AS total FROM services").first<{ total: number }>();
  if (!serviceCount?.total) {
    await database.batch(
      defaultServices.map((service) =>
        database
          .prepare("INSERT INTO services (id, name, description, duration, price_cents, image, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)")
          .bind(...service),
      ),
    );
  }

  const settingStatements = [
    ...defaultServices.map((service) => database.prepare("UPDATE services SET image = ? WHERE id = ? AND image = ''").bind(service[5], service[0])),
    database.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('depositPercent', '30')"),
    database.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('address', 'Endereço da Barbearia 35 • Goiás — GO')"),
    database.prepare(`INSERT INTO settings (key, value) VALUES ('businessHours', '{"1":["09:00","19:00"],"2":["09:00","19:00"],"3":["09:00","19:00"],"4":["09:00","19:00"],"5":["09:00","19:00"],"6":["09:00","18:00"],"0":null}')
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      WHERE settings.value = '{"1":null,"2":["09:00","19:00"],"3":["09:00","19:00"],"4":["09:00","19:00"],"5":["09:00","19:00"],"6":["09:00","18:00"],"0":null}'`),
  ];
  if (configuredPixKey) {
    settingStatements.push(
      database.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('pixKey', ?)").bind(configuredPixKey),
    );
  }
  if (configuredWhatsapp) {
    settingStatements.push(
      database.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('whatsapp', ?)").bind(configuredWhatsapp),
    );
  }
  await database.batch(settingStatements);
}
