import { isAdminRequest } from "@/lib/admin-auth";
import { finishInstagram, INSTAGRAM_ORIGIN } from "@/lib/instagram";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)julie_instagram_state=([^;]+)/)?.[1];
  let result = "failed";
  if (await isAdminRequest(request) && state.length === 72 && cookie === state) {
    if (url.searchParams.has("error")) result = "cancelled";
    else {
      const code = url.searchParams.get("code");
      if (code && code.length < 4096) {
        try { await finishInstagram(code, state); result = "connected"; }
        catch (e) { result = e instanceof Error && e.message.includes("selected account") ? "wrong_account" : "failed"; }
      }
    }
  }
  return new Response(null, {status:303, headers:{Location:INSTAGRAM_ORIGIN + "/admin?instagram=" + result, "Cache-Control":"no-store", "Referrer-Policy":"no-referrer", "Set-Cookie":"julie_instagram_state=; Max-Age=0; Path=/api/admin/instagram; HttpOnly; Secure; SameSite=Lax"}});
}
