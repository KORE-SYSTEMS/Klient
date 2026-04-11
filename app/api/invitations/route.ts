import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET: Validate invitation token (public endpoint for invitation acceptance page)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invalid invitation token" }, { status: 404 });
  }

  if (invitation.used) {
    return NextResponse.json({ error: "Invitation has already been used" }, { status: 410 });
  }

  if (new Date() > invitation.expiresAt) {
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
  }

  return NextResponse.json({
    id: invitation.id,
    email: invitation.email,
    name: invitation.name,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
  });
}

// POST: Accept invitation — create user account with name/password and mark invitation as used
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, name, password } = body;

    if (!token || !name || !password) {
      return NextResponse.json({ error: "Token, name, and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invalid invitation token" }, { status: 404 });
    }

    if (invitation.used) {
      return NextResponse.json({ error: "Invitation has already been used" }, { status: 410 });
    }

    if (new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
    }

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (existingUser) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: invitation.email,
        name,
        password: hashedPassword,
        role: invitation.role,
      },
    });

    // Mark invitation as used
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { used: true },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to accept invitation:", error);
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}
