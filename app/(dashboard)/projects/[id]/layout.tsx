import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { ProjectTabNav } from "./tab-nav";

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
    select: { id: true, name: true, color: true },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div
          className="h-4 w-4 rounded-sm"
          style={{ backgroundColor: project.color || "#E8520A" }}
        />
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {project.name}
        </h1>
      </div>
      <ProjectTabNav projectId={project.id} />
      {children}
    </div>
  );
}
