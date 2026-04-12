import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { exec } from "child_process";

export async function POST() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    // Execute the update script in the background
    // Depending on the OS and setup, this executes the script that uses git pull and docker compose
    exec("bash update.sh", (error, stdout, stderr) => {
      if (error) {
        console.error(`Update script error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Update script stderr: ${stderr}`);
      }
      console.log(`Update script output: ${stdout}`);
    });

    // Return immediately so the UI can show the success message without waiting for restart
    return NextResponse.json({ success: true, message: "Update process started" });
  } catch (error) {
    console.error("Failed to trigger update:", error);
    return NextResponse.json({ error: "Failed to trigger update" }, { status: 500 });
  }
}
