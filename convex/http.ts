import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { oauthCallback } from "./gscActions";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/gsc/oauth/callback",
  method: "GET",
  handler: oauthCallback,
});

export default http;
