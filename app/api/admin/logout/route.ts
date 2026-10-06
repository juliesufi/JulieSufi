import { clearAdminSession } from "../../../../lib/admin-auth";

export async function POST(request: Request) {
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearAdminSession(request) } },
  );
}
