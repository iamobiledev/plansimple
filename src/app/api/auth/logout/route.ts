import { getSession } from "@/server/session";
import { apiHandler, json } from "@/server/http";

export const POST = apiHandler(async () => {
  const session = await getSession();
  session.destroy();
  return json({ ok: true });
});
