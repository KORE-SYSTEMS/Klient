import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CheckSquare,
  FileIcon,
  MessageSquare,
  Users,
  Calendar,
} from "lucide-react";
import { formatDate, getInitials } from "@/lib/utils";
import { ProjectDetailEditor } from "./detail-editor";
import { StatusPill } from "@/components/status-pill";

interface Props {
  params: { id: string };
}

export default async function ProjectDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              image: true,
            },
          },
        },
      },
      _count: {
        select: {
          tasks: true,
          files: true,
          messages: true,
          updates: true,
        },
      },
    },
  });

  if (!project) notFound();

  const isAdmin = session.user.role === "ADMIN";
  const isMember = session.user.role === "MEMBER";
  const canEdit = isAdmin || isMember;

  const taskStats = await prisma.task.groupBy({
    by: ["status"],
    where: { projectId: params.id },
    _count: true,
  });

  const totalTasks = taskStats.reduce((sum, s) => sum + s._count, 0);
  const doneTasks =
    taskStats.find((s) => s.status === "DONE")?._count || 0;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Editable project info */}
      <ProjectDetailEditor
        project={{
          id: project.id,
          name: project.name,
          description: project.description,
        }}
        canEdit={canEdit}
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckSquare className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{totalTasks}</p>
              <p className="text-xs text-muted-foreground">Tasks gesamt</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <FileIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{project._count.files}</p>
              <p className="text-xs text-muted-foreground">Dateien</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{project._count.messages}</p>
              <p className="text-xs text-muted-foreground">Nachrichten</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex-1">
              <p className="text-2xl font-bold">{progress}%</p>
              <p className="text-xs text-muted-foreground">Fortschritt</p>
            </div>
            <div className="h-2 w-20 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task breakdown + Members */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">
              Task-Verteilung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {taskStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Tasks vorhanden
              </p>
            ) : (
              taskStats.map((stat) => (
                <div
                  key={stat.status}
                  className="flex items-center justify-between"
                >
                  <StatusPill value={stat.status} type="task" size="sm" />
                  <span className="text-sm font-medium">{stat._count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">
              Mitglieder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {project.members.map((m) => (
              <div key={m.user.id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.user.image || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(m.user.name || m.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {m.user.name || m.user.email}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.user.role}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Meta info */}
      <Card>
        <CardContent className="flex flex-wrap gap-6 p-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Erstellt: {formatDate(project.createdAt)}
          </span>
          {project.dueDate && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Fällig: {formatDate(project.dueDate)}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {project.members.length} Mitglieder
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
