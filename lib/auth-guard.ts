import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function getSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}

export async function requireProjectAccess(projectId: string, userId: string) {
  const member = await prisma.projectMember.findUnique({
    where: {
      userId_projectId: { userId, projectId },
    },
  });
  return !!member;
}

export async function requireAdminOrMember() {
  const session = await getSession();
  if (!session || session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}

export type AppSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Access to staff-facing records that belong to a project (invoices, proposals).
 * ADMIN: always. CLIENT: never. MEMBER: only for projects they are a member of;
 * records without a project (e.g. proposals for a not-yet-created project) are staff-wide.
 */
export async function canAccessProjectRecord(
  session: AppSession,
  projectId: string | null | undefined
): Promise<boolean> {
  const role = session.user.role;
  if (role === "ADMIN") return true;
  if (role === "CLIENT") return false;
  if (!projectId) return true;
  return requireProjectAccess(projectId, session.user.id);
}

/**
 * Whether the caller may see a task: ADMIN all, MEMBER via project membership,
 * CLIENT only client-visible (or own) tasks in projects they belong to.
 */
export async function canAccessTask(
  session: AppSession,
  task: { projectId: string; clientVisible: boolean; assigneeId: string | null }
): Promise<boolean> {
  const { role, id: userId } = session.user;
  if (role === "ADMIN") return true;
  if (!(await requireProjectAccess(task.projectId, userId))) return false;
  if (role === "CLIENT") return task.clientVisible || task.assigneeId === userId;
  return true;
}
