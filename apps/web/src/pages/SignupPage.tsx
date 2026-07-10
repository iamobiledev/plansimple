import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { apiFetch, type SessionResponse, type User } from "../lib/api";
import { useAuthStore } from "../store/auth";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export default function SignupPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signupMutation = useMutation({
    mutationFn: async () => {
      const session = await apiFetch<SessionResponse>("/auth/register", {
        method: "POST",
        json: { name, email, password },
      });
      window.localStorage.setItem("ps_access", session.accessToken);
      const user = await apiFetch<User>("/auth/me");
      return { session, user };
    },
    onSuccess: ({ session, user }) => {
      setSession({ accessToken: session.accessToken, user });
      navigate("/");
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signupMutation.mutate();
  }

  return (
    <section className="panel p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
        Start clean
      </p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
        Create your PlanSimple account
      </h2>
      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="label">Name</span>
          <input
            className="field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="label">Email</span>
          <input
            className="field"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
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
            required
          />
        </label>
        {signupMutation.isError ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {getErrorMessage(signupMutation.error)}
          </p>
        ) : null}
        <button className="btn-primary w-full" disabled={signupMutation.isPending}>
          {signupMutation.isPending ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link className="font-semibold text-blue-600 hover:text-blue-700" to="/login">
          Sign in
        </Link>
      </p>
    </section>
  );
}
