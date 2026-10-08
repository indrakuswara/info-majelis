import { readLocalImage } from "../../../lib/storage.ts";

// Melayani berkas unggahan driver `local` (dev) di URL `/uploads/<key>`.
// Key divalidasi ketat di `readLocalImage`/`isSafeUploadKey`: satu segmen,
// tanpa `..` dan tanpa pemisah path — traversal selalu berakhir 404 di sini.
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ key: string }> },
) {
  const { key } = await ctx.params;
  const found = await readLocalImage(key);
  if (!found) {
    return new Response("Tidak ditemukan.", { status: 404 });
  }
  return new Response(new Uint8Array(found.data), {
    headers: {
      "Content-Type": found.contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
