export async function register() {
  // Only in the Node server (not Edge, not the build step)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackupScheduler } = await import("@/lib/backup");
    startBackupScheduler();
  }
}
