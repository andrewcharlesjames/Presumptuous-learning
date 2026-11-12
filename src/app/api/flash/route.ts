import { clearFlashCookie } from "@/lib/flash";

/** Clears the one-off message cookie after it has been shown (a plain request, so the page doesn't re-render). */
export async function DELETE() {
  await clearFlashCookie();
  return new Response(null, { status: 204 });
}
