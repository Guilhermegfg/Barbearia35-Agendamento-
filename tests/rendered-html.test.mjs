import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Barbearia 35 landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="pt-BR">/i);
  assert.match(html, /Barbearia 35 \| Tradição no corte/i);
  assert.match(html, /Tradição no corte/i);
  assert.match(html, /Respeito pelo seu tempo/i);
  assert.match(html, /Agendar meu horário/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships booking, admin, persistence and finished metadata", async () => {
  const [bookingPage, adminPage, layout, packageJson, schema, hosting] = await Promise.all([
    readFile(new URL("../app/components/BookingPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AdminPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(bookingPage, /Seu horário em/);
  assert.match(bookingPage, /paymentType/);
  assert.match(adminPage, /Serviços & preços/);
  assert.match(adminPage, /Bloquear horário/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /\/og\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(schema, /scheduleClaims/);
  assert.match(schema, /idx_appointments_request_id/);
  assert.match(hosting, /"d1": "DB"/);

  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});

test("uses resilient document navigation between public routes", async () => {
  const [landingPage, bookingPage, adminPage] = await Promise.all([
    readFile(new URL("../app/components/LandingPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BookingPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AdminPage.tsx", import.meta.url), "utf8"),
  ]);

  for (const page of [landingPage, bookingPage, adminPage]) {
    assert.doesNotMatch(page, /next\/link/);
  }

  assert.match(landingPage, /<a[^>]+href="\/agendar"/);
  assert.match(landingPage, /<a[^>]+href="\/admin"/);
  assert.match(landingPage, /href=\{`\/agendar\?servico=/);
  assert.doesNotMatch(landingPage, /whatsapp-float/);
});

test("keeps Monday open across the booking rules and public schedule", async () => {
  const [schedule, bookingPage, runtime, landingPage] = await Promise.all([
    readFile(new URL("../app/lib/schedule.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BookingPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/runtime.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/LandingPage.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(schedule, /"1": \["09:00", "19:00"\]/);
  assert.match(bookingPage, /"1": \["09:00", "19:00"\]/);
  assert.match(runtime, /'businessHours', '\{"1":\["09:00","19:00"\]/);
  assert.match(landingPage, /Segunda a sexta • 09h às 19h/);
  assert.doesNotMatch(landingPage, /segunda • Fechado/i);
});

test("holds a PIX booking for 15 minutes until the admin confirms payment", async () => {
  const [bookingPage, appointmentRoute, adminPage, adminActions, schema, runtime] = await Promise.all([
    readFile(new URL("../app/components/BookingPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/public/appointments/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AdminPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/actions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/runtime.ts", import.meta.url), "utf8"),
  ]);

  assert.match(bookingPage, /Reservar por 15 minutos/);
  assert.match(bookingPage, /Enviar comprovante agora pelo WhatsApp/);
  assert.match(bookingPage, /Copiar código PIX/);
  assert.match(bookingPage, /pixPayload/);
  assert.match(appointmentRoute, /aguardando_pagamento/);
  assert.match(appointmentRoute, /datetime\('now', '\+15 minutes'\)/);
  assert.match(adminPage, /PIX aguardando confirmação/);
  assert.match(adminPage, /Confirmar PIX/);
  assert.match(adminActions, /case "confirmPayment"/);
  assert.match(schema, /expiresAt: text\("expires_at"\)/);
  assert.match(runtime, /status = 'aguardando_pagamento' AND expires_at <= CURRENT_TIMESTAMP/);
});

test("admin daily agenda can add appointments, block times and count completed revenue", async () => {
  const [adminPage, adminActions] = await Promise.all([
    readFile(new URL("../app/components/AdminPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/actions/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(adminPage, /item\.status === "concluido"\) return sum \+ item\.totalCents/);
  assert.match(adminPage, /\+ Agendar corte/);
  assert.match(adminPage, /Bloquear na agenda/);
  assert.match(adminPage, /Bloqueios do dia/);
  assert.match(adminActions, /case "createAppointment"/);
  assert.match(adminActions, /payment_status, status/);
  assert.match(adminActions, /INSERT INTO schedule_claims/);
});

test("offers 15-minute starts while preserving overlap checks", async () => {
  const [bookingPage, adminPage, publicAppointments, adminActions] = await Promise.all([
    readFile(new URL("../app/components/BookingPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AdminPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/public/appointments/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/actions/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(bookingPage, /minute \+= 15/);
  assert.match(adminPage, /length: 40/);
  assert.match(adminPage, /index \* 15/);
  assert.match(publicAppointments, /start % 15 !== 0/);
  assert.match(adminActions, /start % 15 !== 0/);
  assert.match(publicAppointments, /overlaps\(start, service\.duration/);
});

test("shows service photography and lets the admin replace it", async () => {
  const [landingPage, bookingPage, adminPage, adminActions, runtime] = await Promise.all([
    readFile(new URL("../app/components/LandingPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BookingPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AdminPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/actions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/runtime.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(landingPage, /Café por nossa conta|Estacionamento gratuito/i);
  assert.match(landingPage, /service\.image && <img/);
  assert.match(bookingPage, /booking-service-image/);
  assert.match(adminPage, /Foto de fundo do serviço/);
  assert.match(adminPage, /type="file"/);
  assert.match(adminPage, /resizeServiceImage/);
  assert.match(adminActions, /const image = serviceImage/);
  assert.match(runtime, /\/images\/services\/platinado\.jpg/);

  for (const filename of ["corte-tradicional.jpg", "degrade-fade.jpg", "barba-terapia.jpg", "combo-cabelo-barba.jpg", "platinado.jpg"]) {
    await access(new URL(`../public/images/services/${filename}`, import.meta.url));
  }
});

test("keeps admin credentials and the PIX key out of the repository", async () => {
  const [auth, runtime, bookingPage, exampleEnv] = await Promise.all([
    readFile(new URL("../app/lib/admin-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/runtime.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BookingPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(auth, /env\[name\]/);
  assert.match(auth, /ADMIN_PASSWORD/);
  assert.match(auth, /ADMIN_SESSION_SECRET/);
  assert.match(runtime, /env\.PIX_KEY/);
  assert.doesNotMatch(auth, /process\.env|\|\|\s*["']\d+["']/);
  assert.doesNotMatch(runtime, /VALUES \('pixKey', '\+/);
  assert.doesNotMatch(bookingPage, /pixPayload\(settings\.pixKey \|\|/);
  assert.match(exampleEnv, /ADMIN_PASSWORD=\nADMIN_SESSION_SECRET=\nPIX_KEY=/);
});

test("opens booking on today, starts the calendar on Monday and highlights proof delivery", async () => {
  const [bookingPage, styles] = await Promise.all([
    readFile(new URL("../app/components/BookingPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(bookingPage, /setDate\(isoDate\(new Date\(\)\)\)/);
  assert.match(bookingPage, /daysSinceMonday = \(value\.getDay\(\) \+ 6\) % 7/);
  assert.match(bookingPage, /disabled=\{closed \|\| past\}/);
  assert.match(bookingPage, /Envie o comprovante agora/);
  assert.match(bookingPage, /Enviar comprovante agora pelo WhatsApp/);
  assert.match(styles, /\.proof-warning \{ display: flex/);
  assert.match(styles, /@media \(max-width: 380px\)/);
  assert.match(styles, /\.time-grid \{ grid-template-columns: repeat\(2/);
});
