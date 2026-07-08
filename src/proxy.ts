import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Pages that require a signed-in user. The landing and community stay public.
// Signed-in users still see the landing at "/" (it shows an "Ask for help" CTA
// for them) rather than being force-redirected into the app.
const isProtected = createRouteMatcher(["/onboard(.*)", "/home(.*)", "/ask(.*)", "/settings(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();
});

export const config = {
  matcher: [
    // run on everything except Next internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|gif|png|svg|ico|webp|woff2?|ttf|otf|map)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
