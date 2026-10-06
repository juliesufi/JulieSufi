import { isAdminRequest } from "../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return Response.json({ unlocked: await isAdminRequest(request) });
}
