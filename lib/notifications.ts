import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/mailer";

export type NotificationType =
  | "MENTION"
  | "TASK_ASSIGNED"
  | "TASK_STATUS_CHANGED"
  | "TASK_COMMENT"
  | "TASK_FILE_UPLOADED"
  | "CHAT_MESSAGE"
  | "TASK_DUE_SOON";

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  MENTION: "Erwähnungen (@mention)",
  TASK_ASSIGNED: "Task an mich zugewiesen",
  TASK_STATUS_CHANGED: "Status eines Tasks geändert",
  TASK_COMMENT: "Neuer Kommentar auf Task",
  TASK_FILE_UPLOADED: "Datei auf Task hochgeladen",
  CHAT_MESSAGE: "Neue Chat-Nachricht",
  TASK_DUE_SOON: "Task fällig in Kürze",
};

// Map notification type to the settings column names
function getSettingKeys(type: NotificationType): { inApp: string; email: string } {
  switch (type) {
    case "MENTION":              return { inApp: "inAppMention", email: "emailMention" };
    case "TASK_ASSIGNED":        return { inApp: "inAppTaskAssigned", email: "emailTaskAssigned" };
    case "TASK_STATUS_CHANGED":  return { inApp: "inAppTaskStatusChanged", email: "emailTaskStatusChanged" };
    case "TASK_COMMENT":         return { inApp: "inAppTaskComment", email: "emailTaskComment" };
    case "TASK_FILE_UPLOADED":   return { inApp: "inAppTaskFileUploaded", email: "emailTaskFileUploaded" };
    case "CHAT_MESSAGE":         return { inApp: "inAppChatMessage", email: "emailChatMessage" };
    case "TASK_DUE_SOON":        return { inApp: "inAppTaskDueSoon", email: "emailTaskDueSoon" };
  }
}

export async function getOrCreateNotificationSettings(userId: string) {
  let settings = await prisma.notificationSettings.findUnique({ where: { userId } });
  if (!settings) {
    settings = await prisma.notificationSettings.create({ data: { userId } });
  }
  return settings;
}

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
  emailSubject?: string;
}

/**
 * Creates an in-app notification and sends an email — each gated by the user's
 * notification settings. Never throws — logs errors to console so notifications
 * never block a request.
 */
export async function notify(input: CreateNotificationInput) {
  const { userId, type, title, message, link, actorId, metadata, emailSubject } = input;

  // Don't notify yourself
  if (actorId && actorId === userId) return;

  try {
    const settings = await getOrCreateNotificationSettings(userId);
    const keys = getSettingKeys(type);
    const inAppEnabled = (settings as any)[keys.inApp] as boolean;
    const emailEnabled = (settings as any)[keys.email] as boolean;

    if (inAppEnabled) {
      await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message: message || null,
          link: link || null,
          actorId: actorId || null,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
    }

    if (emailEnabled) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, active: true },
      });
      if (user?.email && user.active) {
        // Fire-and-forget (don't await to avoid slowing down the request)
        sendNotificationEmail({
          to: user.email,
          subject: emailSubject || title,
          title,
          message,
          link,
        }).catch((e) => console.error("Email notification failed:", e));
      }
    }
  } catch (e) {
    console.error("notify() failed:", e);
  }
}

/** Broadcast a notification to many users. */
export async function notifyMany(userIds: string[], input: Omit<CreateNotificationInput, "userId">) {
  await Promise.all(userIds.map((userId) => notify({ ...input, userId })));
}
