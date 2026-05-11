import { Suspense } from "react";

/**
 * Print-Layout: erzwingt Light-Mode (für PDF-Export auf weißem Hintergrund)
 * und unterdrückt Dashboard-Chrome. Wird automatisch beim Mount via
 * useEffect umgeschaltet (in einer kleinen Client-Komponente unten).
 */
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ForceLightMode />
      <Suspense>{children}</Suspense>
    </>
  );
}

// Server-side: can't modify <html> class set by root layout from here.
// Light-mode is forced via the print.css's `html, body { background: white }`
// which overrides the dark theme tokens for this route.
function ForceLightMode() {
  return null;
}
