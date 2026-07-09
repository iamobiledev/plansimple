import { useEffect } from "react";
import { useStore } from "../store";
import LoginPage from "./LoginPage";
import ProjectsPage from "./ProjectsPage";
import Workspace from "./Workspace";

export default function App() {
  const user = useStore((s) => s.user);
  const authChecked = useStore((s) => s.authChecked);
  const project = useStore((s) => s.project);
  const checkAuth = useStore((s) => s.checkAuth);
  const toast = useStore((s) => s.toast);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  if (!authChecked) {
    return <div className="page-center muted">Loading…</div>;
  }

  return (
    <>
      {!user ? <LoginPage /> : project ? <Workspace /> : <ProjectsPage />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
