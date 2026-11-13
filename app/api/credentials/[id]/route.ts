import { getDb } from "@/lib/db/client";
import { getPublishedDocument } from "@/server/services/holders";

/**
 * The public credential document, exactly as sealed. Its SHA-256 is the
 * digest on NEAR and, in Base64, the NFT's reference_hash. Served as-is, never
 * reformatted, so anyone can hash the bytes they receive.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await getPublishedDocument(await getDb(), id);
  if (!document)
    return Response.json({ error: "No published credential has this ID." }, { status: 404 });
  return new Response(document, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
