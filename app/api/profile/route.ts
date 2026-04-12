import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      company: true,
    },
  });

  return NextResponse.json(user);
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const { name, email, company, newPassword } = body;

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (company !== undefined) updateData.company = company;
    
    if (email !== undefined && email !== session.user.email) {
      // check if email is taken
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser && existingUser.id !== session.user.id) {
        return NextResponse.json({ error: "E-Mail wird bereits verwendet" }, { status: 409 });
      }
      updateData.email = email;
    }

    if (newPassword && newPassword.length >= 8) {
      updateData.password = await bcrypt.hash(newPassword, 12);
    } else if (newPassword) {
      return NextResponse.json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    return NextResponse.json({
      name: updatedUser.name,
      email: updatedUser.email,
      company: updatedUser.company,
    });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json({ error: "Profil konnte nicht aktualisiert werden" }, { status: 500 });
  }
}
