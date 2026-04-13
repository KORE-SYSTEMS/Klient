import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { SessionProvider } from "@/components/session-provider";
import { GlobalTimerProvider } from "@/components/global-timer";

import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const workspace = await prisma.workspace.findFirst();

  return (
    <SessionProvider session={session}>
      <GlobalTimerProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar role={session.user.role} logo={workspace?.logo} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Topbar user={session.user} />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
      </GlobalTimerProvider>
    </SessionProvider>
  );
}
