"use client";

import dynamic from "next/dynamic";

// The workspace is a canvas-heavy SPA (pdf.js + Konva) that only runs in the
// browser — skip server rendering entirely.
const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => <div className="page-center muted">Loading…</div>,
});

export default function Page() {
  return <App />;
}
