import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type Organization, type Project } from "../lib/api";

const inviteRoles = ["admin", "editor", "reviewer", "viewer"] as const;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export default function OrgPage() {
  const { orgId } = useParams();
  const queryClient = useQueryClient();
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof inviteRoles)[number]>("viewer");

  const orgQuery = useQuery({
    queryKey: ["organizations", orgId],
    queryFn: () => apiFetch<Organization>(`/organizations/${orgId}`),
    enabled: Boolean(orgId),
  });

  const projectsQuery = useQuery({
    queryKey: ["organizations", orgId, "projects"],
    queryFn: () => apiFetch<Project[]>(`/organizations/${orgId}/projects`),
    enabled: Boolean(orgId),
  });

  const createProjectMutation = useMutation({
    mutationFn: () =>
      apiFetch<Project>(`/organizations/${orgId}/projects`, {
        method: "POST",
        json: {
          name: projectName,
          description: projectDescription || undefined,
        },
      }),
    onSuccess: async () => {
      setProjectName("");
      setProjectDescription("");
      await queryClient.invalidateQueries({
        queryKey: ["organizations", orgId, "projects"],
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/organizations/${orgId}/invitations`, {
        method: "POST",
        json: { email: inviteEmail, role: inviteRole },
      }),
    onSuccess: () => {
      setInviteEmail("");
      setInviteRole("viewer");
    },
  });

  function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createProjectMutation.mutate();
  }

  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    inviteMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link className="text-sm font-semibold text-blue-600 hover:text-blue-700" to="/">
        Back to organizations
      </Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section>
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
              Workspace
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {orgQuery.data?.name ?? "Organization"}
            </h1>
            <p className="mt-2 text-slate-600">
              Projects, team access, and document workflows for this organization.
            </p>
          </div>
          {orgQuery.isError ? (
            <div className="panel mb-6 p-5 text-red-700">
              {getErrorMessage(orgQuery.error)}
            </div>
          ) : null}
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="panel p-5">
              <p className="text-sm text-slate-500">Slug</p>
              <p className="mt-1 font-semibold text-slate-950">
                {orgQuery.data?.slug ?? "..."}
              </p>
            </div>
            <div className="panel p-5">
              <p className="text-sm text-slate-500">Members</p>
              <p className="mt-1 font-semibold text-slate-950">
                {orgQuery.data?.members?.length ?? 0}
              </p>
            </div>
            <div className="panel p-5">
              <p className="text-sm text-slate-500">Projects</p>
              <p className="mt-1 font-semibold text-slate-950">
                {projectsQuery.data?.length ?? 0}
              </p>
            </div>
          </div>
          <div className="panel p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-950">Projects</h2>
            </div>
            {projectsQuery.isLoading ? (
              <p className="mt-5 text-slate-500">Loading projects...</p>
            ) : projectsQuery.isError ? (
              <p className="mt-5 text-red-700">{getErrorMessage(projectsQuery.error)}</p>
            ) : projectsQuery.data?.length ? (
              <div className="mt-5 divide-y divide-slate-200">
                {projectsQuery.data.map((project) => (
                  <Link
                    className="block py-4 transition hover:bg-slate-50"
                    key={project.id}
                    to={`/orgs/${orgId}/projects/${project.id}`}
                  >
                    <p className="font-semibold text-slate-950">{project.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {project.description || "No description yet"}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-slate-500">No projects yet. Create one to begin.</p>
            )}
          </div>
        </section>
        <aside className="space-y-6">
          <div className="panel p-6">
            <h2 className="text-xl font-bold text-slate-950">Create project</h2>
            <form className="mt-5 space-y-4" onSubmit={handleCreateProject}>
              <label className="block space-y-2">
                <span className="label">Project name</span>
                <input
                  className="field"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="Downtown medical office"
                  required
                />
              </label>
              <label className="block space-y-2">
                <span className="label">Description</span>
                <textarea
                  className="field min-h-24"
                  value={projectDescription}
                  onChange={(event) => setProjectDescription(event.target.value)}
                  placeholder="Scope, phase, or delivery notes"
                />
              </label>
              {createProjectMutation.isError ? (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {getErrorMessage(createProjectMutation.error)}
                </p>
              ) : null}
              <button
                className="btn-primary w-full"
                disabled={createProjectMutation.isPending}
              >
                {createProjectMutation.isPending ? "Creating..." : "Create project"}
              </button>
            </form>
          </div>
          <div className="panel p-6">
            <h2 className="text-xl font-bold text-slate-950">Invite teammate</h2>
            <form className="mt-5 space-y-4" onSubmit={handleInvite}>
              <label className="block space-y-2">
                <span className="label">Email</span>
                <input
                  className="field"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="estimator@example.com"
                  required
                />
              </label>
              <label className="block space-y-2">
                <span className="label">Role</span>
                <select
                  className="field"
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(event.target.value as (typeof inviteRoles)[number])
                  }
                >
                  {inviteRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              {inviteMutation.isError ? (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {getErrorMessage(inviteMutation.error)}
                </p>
              ) : null}
              {inviteMutation.isSuccess ? (
                <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Invitation created and email queued.
                </p>
              ) : null}
              <button className="btn-primary w-full" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? "Sending..." : "Send invitation"}
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
