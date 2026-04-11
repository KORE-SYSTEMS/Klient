import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, CheckSquare, MessageSquare, FileIcon } from "lucide-react";
import Link from "next/link";
import { getStatusColor, formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isClient = session.user.role === "CLIENT";

  const projectWhere = isClient
    ? { members: { some: { userId: session.user.id } } }
    : {};

  const [projects, tasks, messages, files] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      include: { members: { include: { user: true } }, _count: { select: { tasks: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: isClient
        ? { project: { members: { some: { userId: session.user.id } } }, clientVisible: true, status: { not: "DONE" } }
        : { status: { not: "DONE" } },
      include: { project: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.message.count({
      where: isClient
        ? { project: { members: { some: { userId: session.user.id } } } }
        : {},
    }),
    prisma.file.count({
      where: isClient
        ? { project: { members: { some: { userId: session.user.id } } }, clientVisible: true }
        : {},
    }),
  ]);

  const projectCount = await prisma.project.count({ where: projectWhere });
  const openTaskCount = await prisma.task.count({
    where: isClient
      ? { project: { members: { some: { userId: session.user.id } } }, clientVisible: true, status: { not: "DONE" } }
      : { status: { not: "DONE" } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isClient ? "Willkommen" : "Dashboard"}
        </h1>
        <p className="text-muted-foreground">
          {isClient
            ? "Übersicht über Ihre Projekte"
            : "Übersicht über alle Projekte und Aufgaben"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projekte
            </CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Offene Tasks
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTaskCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Nachrichten
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{messages}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dateien
            </CardTitle>
            <FileIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{files}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Aktuelle Projekte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.length === 0 && (
              <p className="text-sm text-muted-foreground">Keine Projekte vorhanden</p>
            )}
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between rounded-sm border p-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: project.color || "#E8520A" }}
                  />
                  <div>
                    <div className="font-medium text-sm">{project.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {project._count.tasks} Tasks
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className={getStatusColor(project.status)}>
                  {project.status}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Offene Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.length === 0 && (
              <p className="text-sm text-muted-foreground">Keine offenen Tasks</p>
            )}
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/projects/${task.projectId}/tasks`}
                className="flex items-center justify-between rounded-sm border p-3 transition-colors hover:bg-accent"
              >
                <div>
                  <div className="font-medium text-sm">{task.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {task.project.name}
                    {task.dueDate && ` · ${formatDate(task.dueDate)}`}
                  </div>
                </div>
                <Badge variant="secondary" className={getStatusColor(task.status)}>
                  {task.status.replace("_", " ")}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
