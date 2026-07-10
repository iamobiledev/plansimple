import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type OrganizationSummary } from "../lib/api";
import { useAuthStore } from "../store/auth";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export default function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const suggestedSlug = useMemo(() => slugify(name), [name]);

  const orgsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: () => apiFetch<OrganizationSummary[]>("/organizations"),
  });

  const createOrgMutation = useMutation({
    mutationFn: () =>
      apiFetch<OrganizationSummary>("/organizations", {
        method: "POST",
        json: { name, slug: slug || suggestedSlug },
      }),
    onSuccess: async (org) => {
      setName("");
      setSlug("");
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      navigate(`/orgs/${org.id}`);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createOrgMutation.mutate();
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_380px]">
      <section>
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
            Organizations
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Good morning{user?.name ? `, ${user.name}` : ""}.
          </h1>
          <p className="mt-2 text-slate-600">
            Select an organization to manage projects, documents, and invitations.
          </p>
        </div>
        {orgsQuery.isLoading ? (
          <div className="panel p-8 text-slate-500">Loading organizations...</div>
        ) : orgsQuery.isError ? (
          <div className="panel p-8 text-red-700">{getErrorMessage(orgsQuery.error)}</div>
        ) : orgsQuery.data?.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {orgsQuery.data.map((org) => (
              <Link
                className="panel block p-6 transition hover:-translate-y-0.5 hover:border-blue-200"
                key={org.id}
                to={`/orgs/${org.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">{org.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">/{org.slug}</p>
                  </div>
                  {org.role ? (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-blue-700">
                      {org.role}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="panel p-8">
            <h2 className="text-xl font-bold text-slate-950">Create your first org</h2>
            <p className="mt-2 text-slate-600">
              PlanSimple workspaces are organized by company or project team.
            </p>
          </div>
        )}
      </section>
      <aside className="panel h-fit p-6">
        <h2 className="text-xl font-bold text-slate-950">Create organization</h2>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="label">Organization name</span>
            <input
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Northline Builders"
              required
            />
          </label>
          <label className="block space-y-2">
            <span className="label">Slug</span>
            <input
              className="field"
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
              placeholder={suggestedSlug || "northline-builders"}
            />
          </label>
          {createOrgMutation.isError ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {getErrorMessage(createOrgMutation.error)}
            </p>
          ) : null}
          <button className="btn-primary w-full" disabled={createOrgMutation.isPending}>
            {createOrgMutation.isPending ? "Creating..." : "Create organization"}
          </button>
        </form>
      </aside>
    </div>
  );
}
