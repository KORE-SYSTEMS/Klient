import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

// GET: Fetch workspace settings
export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  // Get the first (and only) workspace record, or create a default one
  let workspace = await prisma.workspace.findFirst();

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Klient",
        primaryColor: "#E8520A",
      },
    });
  }

  return NextResponse.json(workspace);
}

// PATCH: Update workspace settings
export async function PATCH(request: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();

    // Get or create workspace
    let workspace = await prisma.workspace.findFirst();

    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          name: "Klient",
          primaryColor: "#E8520A",
        },
      });
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.logo !== undefined) updateData.logo = body.logo;
    if (body.primaryColor !== undefined) updateData.primaryColor = body.primaryColor;
    if (body.smtpHost !== undefined) updateData.smtpHost = body.smtpHost;
    if (body.smtpPort !== undefined) updateData.smtpPort = body.smtpPort;
    if (body.smtpUser !== undefined) updateData.smtpUser = body.smtpUser;
    if (body.smtpPass !== undefined) updateData.smtpPass = body.smtpPass;
    if (body.smtpFrom !== undefined) updateData.smtpFrom = body.smtpFrom;
    if (body.inviteEmailSubject !== undefined) updateData.inviteEmailSubject = body.inviteEmailSubject;
    if (body.inviteEmailTemplate !== undefined) updateData.inviteEmailTemplate = body.inviteEmailTemplate;

    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update workspace settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
