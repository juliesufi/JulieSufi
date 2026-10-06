import { instagramFeed } from "@/lib/instagram";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = {"Cache-Control":"private, no-store"};
  try { return Response.json(await instagramFeed(), {headers}); }
  catch { return Response.json({error:"Instagram is temporarily unavailable."}, {status:503, headers}); }
}
