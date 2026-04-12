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
    select: { id: true, name: true, color: true, status: true },
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

  return (
    <div className="space-y-4">
      <ProjectHeader project={project} canEdit={canEdit} />
      <ProjectTabNav projectId={project.id} />
      <div className="pt-2">{children}</div>
    </div>
  );
}
