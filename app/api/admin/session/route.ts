import { isAdmin, logoutResponse } from "../../../lib/admin-auth";

export async function GET(request: Request) {
  return Response.json({ authenticated: await isAdmin(request) });
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": logoutResponse() } });
}
