import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Pages that require a signed-in user. The landing and community stay public.
const isProtected = createRouteMatcher(["/onboard(.*)", "/home(.*)", "/ask(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();
});

export const config = {
  matcher: [
    // run on everything except Next internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|gif|png|svg|ico|webp|woff2?|ttf|otf|map)).*)",
    "/(api|trpc)(.*)",
  ],
};
