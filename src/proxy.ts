import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

// Next 16 renamed Middleware to Proxy; this file replaces `middleware.ts`.
//
// Its job is session refresh: Supabase's access token is short-lived, and if
// nothing refreshes it on the way in, a server render can find a stale token
// and sign the person out mid-meal. The auth check here is a redirect for the
// sake of the UI — it is not the security boundary. That is RLS, plus a
// `getUser()` inside anything that actually touches data.

/** Paths a signed-out visitor may see. Everything else redirects to /login. */
const PUBLIC_PATHS = ["/", "/login"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/auth/");
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Refreshed tokens ride on Set-Cookie; these headers keep a CDN from
        // handing one person's session to the next visitor.
        for (const [header, value] of Object.entries(headers)) {
          response.headers.set(header, value);
        }
      },
    },
  });

  // Must happen before any response is returned, or a refresh that lands late
  // has nowhere to write its cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (user && (pathname === "/login" || pathname === "/")) {
    return NextResponse.redirect(new URL("/tonight", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own assets and static files — the proxy has to
     * see normal page requests to refresh a session, and nothing else.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
