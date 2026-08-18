import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    duration: integer("duration").notNull(),
    priceCents: integer("price_cents").notNull(),
    image: text("image").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_services_active_sort").on(table.active, table.sortOrder)],
);

export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    whatsapp: text("whatsapp").notNull(),
    serviceId: text("service_id").notNull(),
    serviceName: text("service_name").notNull(),
    serviceDuration: integer("service_duration").notNull(),
    date: text("date").notNull(),
    time: text("time").notNull(),
    totalCents: integer("total_cents").notNull(),
    paymentType: text("payment_type").notNull(),
    paymentAmountCents: integer("payment_amount_cents").notNull(),
    paymentStatus: text("payment_status").notNull().default("pendente"),
    status: text("status").notNull().default("confirmado"),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_appointments_request_id").on(table.requestId),
    uniqueIndex("idx_appointments_active_slot")
      .on(table.date, table.time)
      .where(sql`${table.status} != 'cancelado'`),
    index("idx_appointments_date_status").on(table.date, table.status),
  ],
);

export const blockedTimes = sqliteTable(
  "blocked_times",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    time: text("time").notNull().default(""),
    reason: text("reason").notNull().default("Bloqueado pela equipe"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_blocked_date_time").on(table.date, table.time),
    index("idx_blocked_date").on(table.date),
  ],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const scheduleClaims = sqliteTable(
  "schedule_claims",
  {
    claimDate: text("claim_date").notNull(),
    slotMinute: integer("slot_minute").notNull(),
    ownerType: text("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.claimDate, table.slotMinute] }),
    index("idx_schedule_claims_owner").on(table.ownerType, table.ownerId),
  ],
);
