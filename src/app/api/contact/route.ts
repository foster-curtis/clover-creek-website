import { NextResponse, type NextRequest } from "next/server";
import { notifyOwnerInquiry } from "@/lib/email";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot
  if (typeof body.website === "string" && body.website.length > 0) {
    return NextResponse.json({ ok: true }); // pretend success to bots
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.body ?? "").trim();
  if (name.length < 2 || !/.+@.+\..+/.test(email) || message.length < 10) {
    return NextResponse.json(
      { error: "Please fill in your name, a valid email, and a message." },
      { status: 400 }
    );
  }

  if (hasServiceRole()) {
    const { error } = await supabaseAdmin()
      .from("inquiries")
      .insert({ name, email, body: message });
    if (error) console.error("Failed to save inquiry:", error);
  }

  await notifyOwnerInquiry(name, email, message);
  return NextResponse.json({ ok: true });
}
