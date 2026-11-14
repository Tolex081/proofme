import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { exportAccountData } from "@/server/services/account";

/** Downloads everything Atesta holds about the signed-in person, as JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Sign in to download your data." }, { status: 401 });
  }
  const data = await exportAccountData(await getDb(), user.id);
  if (!data) return Response.json({ error: "No account found." }, { status: 404 });

  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="atesta-export-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
