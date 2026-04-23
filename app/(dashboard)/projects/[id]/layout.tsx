import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { ProjectTabNav } from "./tab-nav";
import { ProjectHeader } from "./project-header";

interface Props {
  children: React.ReactNode;
  params: { id: string };
}

export default async function ProjectLayout({ children, params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const projectId = params.id;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      color: true,
      dueDate: true,
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true, image: true },
          },
        },
      },
    },
  });

  if (!project) notFound();

  if (session.user.role === "CLIENT") {
    const member = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId,
        },
      },
    });
    if (!member) notFound();
  }

  const canEdit = session.user.role === "ADMIN" || session.user.role === "MEMBER";
  const isClient = session.user.role === "CLIENT";

  // Progress: "done" is semantic via category, not last-column.
  // Clients only count their clientVisible tasks so the bar matches what they see.
  const taskFilter = isClient
    ? { projectId, clientVisible: true }
    : { projectId };
  const [totalTasks, doneStatuses] = await Promise.all([
    prisma.task.count({ where: taskFilter }),
    prisma.taskStatus.findMany({
      where: { projectId, category: "DONE" },
      select: { id: true },
    }),
  ]);
  const doneStatusIds = doneStatuses.map((s) => s.id);
  const doneTasks = doneStatusIds.length
    ? await prisma.task.count({
        where: { ...taskFilter, status: { in: doneStatusIds } },
      })
    : 0;

  return (
    <div className="space-y-4">
      <ProjectHeader
        project={{
          ...project,
          dueDate: project.dueDate?.toISOString() || null,
        }}
        canEdit={canEdit}
        initialMembers={project.members.map((m) => m.user)}
        progress={{ done: doneTasks, total: totalTasks }}
      />
      <ProjectTabNav projectId={project.id} />
      <div className="pt-2">{children}</div>
    </div>
  );
}
