import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Where the emailed link lands. Supabase sends the browser here with a PKCE
 * `code`; we trade it for a session and set the cookies, then get out of the
 * way. The verifier half of the pair was written when the link was requested,
 * which is why a link only works in the browser that asked for it.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/tonight";
  const destination =
    next.startsWith("/") && !next.startsWith("//") ? next : "/tonight";

  const failed = new URL("/login", request.url);
  failed.searchParams.set("error", "link");

  if (!code) return NextResponse.redirect(failed);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(failed);

  return NextResponse.redirect(new URL(destination, request.url));
}
