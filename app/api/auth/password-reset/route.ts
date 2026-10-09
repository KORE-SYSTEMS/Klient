import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mailer";

const TOKEN_TTL_MS = 60 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// POST { email } — request a reset link. Always answers the same (no user enumeration).
// POST { token, password } — set a new password.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (body.token) {
    const password = String(body.password ?? "");
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Das Passwort muss mindestens 8 Zeichen lang sein" },
        { status: 400 }
      );
    }
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(String(body.token)) },
    });
    if (!record || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Der Link ist ungültig oder abgelaufen" },
        { status: 400 }
      );
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: await hash(password, 10) },
      }),
      prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
    ]);
    return NextResponse.json({ ok: true });
  }

  const email = String(body.email ?? "").trim();
  const generic = NextResponse.json({ ok: true });
  if (!email) return generic;

  const user = await prisma.user.findFirst({ where: { email, active: true } });
  if (!user) return generic;

  // Throttle: one mail per user per minute
  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - MIN_INTERVAL_MS) } },
  });
  if (recent) return generic;

  await prisma.passwordResetToken.deleteMany({
    where: { OR: [{ userId: user.id }, { expiresAt: { lt: new Date() } }] },
  });

  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const resetLink = `${baseUrl}/reset-password/${token}`;
  const result = await sendPasswordResetEmail({ to: user.email, name: user.name, resetLink });
  if (!result.sent) {
    // Lockout fallback: whoever can read the server logs may use the link.
    console.warn(`[password-reset] Mail not sent (${result.reason}). Link for ${user.email}: ${resetLink}`);
  }
  return generic;
}
