import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isPublicPage = createRouteMatcher(["/login"]);
const isPublicApi = createRouteMatcher(["/api/bookings"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
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
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
