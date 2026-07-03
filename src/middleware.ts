import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Pages that require a signed-in user. The landing and community stay public.
const isProtected = createRouteMatcher(["/onboard(.*)", "/home(.*)", "/ask(.*)", "/settings(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Authenticated users skip the marketing landing and go straight into the app.
  if (userId && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/ask", req.url));
  }

  if (isProtected(req)) await auth.protect();
});

export const config = {
  matcher: [
    // run on everything except Next internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|gif|png|svg|ico|webp|woff2?|ttf|otf|map)).*)",
    "/(api|trpc)(.*)",
  ],
};
