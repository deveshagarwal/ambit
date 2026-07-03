import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { extractText, getDocumentProxy } from "unpdf";
import { extractResume } from "@/lib/agent";

export const runtime = "nodejs";
// Headroom over the AI client's 15s timeout (same pattern as the persona route).
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024; // 8MB is generous for any LinkedIn PDF/resume

// Upload a LinkedIn "Save to PDF" export or a resume; returns the raw text plus
// LLM-structured summary fields for the onboarding form to prefill. The raw text
// is what buildPersona later mines for attributes, so even if the LLM fields come
// back empty the upload is still useful.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a PDF file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That file is too large (max 8MB)." }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Upload a PDF (LinkedIn's Save to PDF or a resume)." }, { status: 400 });
  }

  let text = "";
  try {
    const buffer = await file.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const extracted = await extractText(pdf, { mergePages: true });
    text = (Array.isArray(extracted.text) ? extracted.text.join("\n") : extracted.text).trim();
  } catch (err) {
    console.error("[extract] pdf text extraction failed:", err);
    return NextResponse.json(
      { error: "Couldn't read that PDF. Try re-exporting it from LinkedIn." },
      { status: 422 },
    );
  }

  if (!text) {
    return NextResponse.json(
      { error: "That PDF has no readable text (it may be a scan). Try LinkedIn's Save to PDF." },
      { status: 422 },
    );
  }

  const fields = await extractResume(text);
  return NextResponse.json({ text: text.slice(0, 20000), fields });
}
