import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { nanoid } from "nanoid";

// GET: List all client users (admin only)
export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const clients = await prisma.user.findMany({
    where: { role: "CLIENT" },
    select: {
      id: true,
      email: true,
      name: true,
      company: true,
      image: true,
      active: true,
      createdAt: true,
      projects: {
        include: {
          project: { select: { id: true, name: true, status: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(clients);
}

// POST: Create invitation for a new client (admin only)
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const { email, name, role } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    // Check if there's already a pending invitation for this email
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return NextResponse.json({ error: "An active invitation already exists for this email" }, { status: 409 });
    }

    // Create invitation with token
    const token = nanoid(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    const invitation = await prisma.invitation.create({
      data: {
        email,
        name: name || undefined,
        role: role || "CLIENT",
        token,
        expiresAt,
      },
    });

    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create invitation:", error);
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  }
}
