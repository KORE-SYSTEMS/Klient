/**
 * Global search endpoint for the Command Palette (⌘K).
 *
 * Searches across projects, tasks, files, and (for admins/members) clients.
 * Access control mirrors the existing resource routes: ADMIN sees everything,
 * MEMBER sees projects they're a member of, CLIENT only their own projects
 * and client-visible tasks/files.
 *
 * Returns a flat, ranked, capped list so the UI stays fast — the palette is
 * designed to show the first ~20 best hits, not exhaustively list matches.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const LIMIT_PER_TYPE = 8;

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const userId = session.user.id;
  const role = session.user.role;

  // Scope: projects this user can see
  const projectScope =
    role === "ADMIN"
      ? {}
      : { members: { some: { userId } } };

  const taskProjectScope =
    role === "ADMIN"
      ? {}
      : { project: { members: { some: { userId } } } };

  const [projects, tasks, files, clients] = await Promise.all([
    prisma.project.findMany({
      where: {
        AND: [
          projectScope,
          {
            OR: [
              { name: { contains: q } },
              { description: { contains: q } },
            ],
          },
        ],
      },
      select: { id: true, name: true, status: true, color: true },
      take: LIMIT_PER_TYPE,
      orderBy: { updatedAt: "desc" },
    }),

    prisma.task.findMany({
      where: {
        AND: [
          taskProjectScope,
          role === "CLIENT" ? { clientVisible: true } : {},
          {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        projectId: true,
        project: { select: { name: true, color: true } },
      },
      take: LIMIT_PER_TYPE,
      orderBy: { updatedAt: "desc" },
    }),

    prisma.file.findMany({
      where: {
        AND: [
          role === "ADMIN"
            ? {}
            : { project: { members: { some: { userId } } } },
          role === "CLIENT" ? { clientVisible: true } : {},
          { name: { contains: q } },
        ],
      },
      select: {
        id: true,
        name: true,
        mimeType: true,
        projectId: true,
        taskId: true,
        project: { select: { name: true } },
      },
      take: LIMIT_PER_TYPE,
      orderBy: { createdAt: "desc" },
    }),

    // Clients (User with CLIENT role) only visible to admins/members
    role === "CLIENT"
      ? Promise.resolve([] as Array<{ id: string; name: string | null; email: string; company: string | null; image: string | null }>)
      : prisma.user.findMany({
          where: {
            role: "CLIENT",
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { company: { contains: q } },
            ],
          },
          select: { id: true, name: true, email: true, company: true, image: true },
          take: LIMIT_PER_TYPE,
          orderBy: { name: "asc" },
        }),
  ]);

  return NextResponse.json({
    results: {
      projects: projects.map((p) => ({
        type: "project" as const,
        id: p.id,
        title: p.name,
        subtitle: p.status,
        color: p.color,
        href: `/projects/${p.id}`,
      })),
      tasks: tasks.map((t) => ({
        type: "task" as const,
        id: t.id,
        title: t.title,
        subtitle: t.project?.name,
        status: t.status,
        priority: t.priority,
        color: t.project?.color,
        href: `/projects/${t.projectId}?task=${t.id}`,
      })),
      files: files.map((f) => ({
        type: "file" as const,
        id: f.id,
        title: f.name,
        subtitle: f.project?.name,
        mimeType: f.mimeType,
        href: `/projects/${f.projectId}${f.taskId ? `?task=${f.taskId}` : ""}`,
      })),
      clients: clients.map((c) => ({
        type: "client" as const,
        id: c.id,
        title: c.name || c.email,
        subtitle: c.company || c.email,
        image: c.image,
        href: `/clients/${c.id}`,
      })),
    },
  });
}
