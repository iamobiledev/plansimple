import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

type AcceptInviteResponse = {
  organization?: {
    name: string;
  } | null;
  role: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const acceptMutation = useMutation({
    mutationFn: () =>
      apiFetch<AcceptInviteResponse>("/invitations/accept", {
        method: "POST",
        json: {
          token,
          name: name || undefined,
          password: password || undefined,
        },
      }),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    acceptMutation.mutate();
  }

  return (
    <section className="panel p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
        Team invitation
      </p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
        Accept your PlanSimple invite
      </h2>
      {acceptMutation.isSuccess ? (
        <div className="mt-8 rounded-2xl bg-emerald-50 p-5 text-emerald-900">
          <p className="font-semibold">Invitation accepted.</p>
          <p className="mt-2 text-sm">
            You joined {acceptMutation.data.organization?.name ?? "the organization"} as{" "}
            {acceptMutation.data.role}. Sign in to continue.
          </p>
          <Link className="btn-primary mt-5" to="/login">
            Go to sign in
          </Link>
        </div>
      ) : (
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="label">Invitation token</span>
            <input
              className="field"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
            />
          </label>
          <label className="block space-y-2">
            <span className="label">Name</span>
            <input
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              placeholder="Required for new accounts"
            />
          </label>
          <label className="block space-y-2">
            <span className="label">Password</span>
            <input
              className="field"
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Required if your account is new"
            />
          </label>
          {acceptMutation.isError ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {getErrorMessage(acceptMutation.error)}
            </p>
          ) : null}
          <button className="btn-primary w-full" disabled={acceptMutation.isPending}>
            {acceptMutation.isPending ? "Accepting..." : "Accept invitation"}
          </button>
        </form>
      )}
    </section>
  );
}
