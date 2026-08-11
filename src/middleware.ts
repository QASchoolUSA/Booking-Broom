import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import type { NextRequest } from "next/server";

const isPublicPage = createRouteMatcher([
  "/login",
  "/manifest.webmanifest",
  "/manifest.json",
]);
const isPublicApi = createRouteMatcher([
  "/api/bookings",
  "/api/pricing",
  "/gsc/oauth/callback",
]);

function isGscOAuthCallback(request: NextRequest) {
  return request.nextUrl.pathname === "/gsc/oauth/callback";
}

function isStaticAsset(pathname: string) {
  return (
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icons/")
  );
}

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const isAuthenticated = await convexAuth.isAuthenticated();

    if (isPublicApi(request) || isStaticAsset(request.nextUrl.pathname)) {
      return;
    }

    if (!isAuthenticated && !isPublicPage(request)) {
      return nextjsMiddlewareRedirect(request, "/login");
    }

    if (isAuthenticated && isPublicPage(request)) {
      // Stay on public assets (manifest) even when signed in — don't bounce to /
      if (isStaticAsset(request.nextUrl.pathname)) {
        return;
      }
      return nextjsMiddlewareRedirect(request, "/");
    }
  },
  {
    // Google Search Console OAuth also returns `?code=` — do not treat it as
    // Convex Auth sign-in (that would clear the session and drop the code).
    shouldHandleCode: async (request) => !isGscOAuthCallback(request),
  }
);

export const config = {
  matcher: [
    // Skip Next internals, images, and the web app manifest (must stay JSON).
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|manifest\\.json|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
