import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { getOrCreateNotificationSettings } from "@/lib/notifications";

const ALLOWED_FIELDS = [
  "inAppMention", "inAppTaskAssigned", "inAppTaskStatusChanged", "inAppTaskComment",
  "inAppTaskFileUploaded", "inAppChatMessage", "inAppTaskDueSoon",
  "emailMention", "emailTaskAssigned", "emailTaskStatusChanged", "emailTaskComment",
  "emailTaskFileUploaded", "emailChatMessage", "emailTaskDueSoon",
];

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const settings = await getOrCreateNotificationSettings(session.user.id);
  return NextResponse.json(settings);
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const data: Record<string, boolean> = {};
  for (const key of ALLOWED_FIELDS) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }

  await getOrCreateNotificationSettings(session.user.id); // ensure row exists
  const updated = await prisma.notificationSettings.update({
    where: { userId: session.user.id },
    data,
  });

  return NextResponse.json(updated);
}
