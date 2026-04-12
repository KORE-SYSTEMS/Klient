import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";

interface Props {
  params: { id: string };
}

export default async function ProjectMembersPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const id = params.id;

  const project = await prisma.project.findUnique({
    where: { id },
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
    },
  });

  if (!project) notFound();

  // If user is a client, verify they are part of the project
  if (session.user.role === "CLIENT") {
    const isMember = project.members.some((m) => m.user.id === session.user.id);
    if (!isMember) notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold font-heading">Projekt-Beteiligte</h2>
        <p className="text-muted-foreground">Alle Kunden und Mitarbeiter in diesem Projekt</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {project.members.map(({ user }) => (
          <Card key={user.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user.image || undefined} />
                <AvatarFallback>{getInitials(user.name || user.email)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="font-medium truncate">{user.name || "Kein Name"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {user.email.startsWith("placeholder-") ? "Keine E-Mail" : user.email}
                </div>
                <div className="mt-1">
                  <Badge variant={user.role === "CLIENT" ? "outline" : "secondary"} className="text-[10px]">
                    {user.role === "CLIENT" ? "Kunde" : user.role === "ADMIN" ? "Admin" : "Mitarbeiter"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {project.members.length === 0 && (
          <div className="col-span-full py-8 text-center text-muted-foreground">
            Es sind noch keine Mitglieder diesem Projekt zugewiesen.
          </div>
        )}
      </div>
    </div>
  );
}
