import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import type { NextRequest } from "next/server";

const isPublicPage = createRouteMatcher(["/login"]);
const isPublicApi = createRouteMatcher([
  "/api/bookings",
  "/gsc/oauth/callback",
]);

function isGscOAuthCallback(request: NextRequest) {
  return request.nextUrl.pathname === "/gsc/oauth/callback";
}

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const isAuthenticated = await convexAuth.isAuthenticated();

    if (isPublicApi(request)) {
      return;
    }

    if (!isAuthenticated && !isPublicPage(request)) {
      return nextjsMiddlewareRedirect(request, "/login");
    }

    if (isAuthenticated && isPublicPage(request)) {
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
