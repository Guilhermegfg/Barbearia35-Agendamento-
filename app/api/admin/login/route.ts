import { loginResponse, validPassword } from "../../../lib/admin-auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (!validPassword(body.password)) return Response.json({ error: "Senha incorreta. Tente novamente." }, { status: 401 });
  return Response.json({ ok: true }, { headers: { "Set-Cookie": await loginResponse() } });
}
