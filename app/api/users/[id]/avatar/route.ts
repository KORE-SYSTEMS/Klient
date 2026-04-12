import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { image: true },
  });
  
  if (!user || !user.image) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const matches = user.image.match(/^data:([a-zA-Z0-9-+\/]+);base64,(.+)$/);

  if (matches?.length !== 3) {
    return new NextResponse("Invalid Image Data", { status: 400 });
  }

  const type = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
