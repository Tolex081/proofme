import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth/server";
import { databaseReady } from "@/lib/db/client";

// All sign-up, sign-in, sign-out and session requests are handled by the
// authentication library. Nothing here builds tokens or sessions by hand.
async function handle(request: Request) {
  await databaseReady();
  const handlers = toNextJsHandler(getAuth());
  return request.method === "GET" ? handlers.GET(request) : handlers.POST(request);
}

export const GET = handle;
export const POST = handle;
