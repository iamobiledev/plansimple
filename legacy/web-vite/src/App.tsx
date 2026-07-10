import { useEffect } from "react";
import { Link, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type User } from "./lib/api";
import { useAuthStore } from "./store/auth";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import HomePage from "./pages/HomePage";
import OrgPage from "./pages/OrgPage";
import ProjectPage from "./pages/ProjectPage";

function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-600/25">
        PS
      </span>
      <span>
        <span className="block text-lg font-black tracking-tight text-slate-950">
          PlanSimple
        </span>
        <span className="block text-xs font-medium uppercase tracking-[0.22em] text-blue-600">
          Construction Docs
        </span>
      </span>
    </Link>
  );
}

function PublicLayout() {
  return (
    <main className="blueprint-grid min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_440px] lg:items-center">
          <section className="hidden lg:block">
            <BrandMark />
            <h1 className="mt-10 max-w-2xl text-5xl font-black tracking-tight text-slate-950">
              Coordinate drawings, markups, and project teams without the noise.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              PlanSimple brings construction document workflows into one clean,
              professional workspace for owners, builders, and consultants.
            </p>
          </section>
          <Outlet />
        </div>
      </div>
    </main>
  );
}

function ProtectedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrate = useAuthStore((state) => state.hydrate);
  const setSession = useAuthStore((state) => state.setSession);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const meQuery = useQuery({
    queryKey: ["me", accessToken],
    queryFn: () => apiFetch<User>("/auth/me"),
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    if (meQuery.data && accessToken) {
      setSession({ accessToken, user: meQuery.data });
    }
  }, [accessToken, meQuery.data, setSession]);

  useEffect(() => {
    if (meQuery.isError) {
      logout();
      navigate("/login", { replace: true });
    }
  }, [logout, meQuery.isError, navigate]);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <BrandMark />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {meQuery.data?.email ?? "Loading account..."}
            </span>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                logout();
                queryClient.clear();
                navigate("/login");
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
      </Route>
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/orgs/:orgId" element={<OrgPage />} />
        <Route path="/orgs/:orgId/projects/:projectId" element={<ProjectPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
