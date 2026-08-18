import { env } from "cloudflare:workers";

const COOKIE_NAME = "barbearia35_admin";

function secret(name: "ADMIN_PASSWORD" | "ADMIN_SESSION_SECRET") {
  const value = env[name];
  return typeof value === "string" ? value : "";
}

async function token() {
  const sessionSecret = secret("ADMIN_SESSION_SECRET");
  if (!sessionSecret) return "";
  const bytes = new TextEncoder().encode(`barbearia35:${sessionSecret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") || "";
  const item = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item?.slice(name.length + 1) || "";
}

export async function isAdmin(request: Request) {
  const expected = await token();
  return Boolean(expected) && cookieValue(request, COOKIE_NAME) === expected;
}

export async function loginResponse() {
  const value = await token();
  if (!value) throw new Error("A autenticação administrativa não está configurada.");
  return `barbearia35_admin=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
}

export function logoutResponse() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export function validPassword(value: unknown) {
  const configuredPassword = secret("ADMIN_PASSWORD");
  return Boolean(configuredPassword) && typeof value === "string" && value === configuredPassword;
}

export function unauthorized() {
  return Response.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
}
