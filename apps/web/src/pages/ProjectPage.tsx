import { Link, useParams } from "react-router-dom";

export default function ProjectPage() {
  const { orgId, projectId } = useParams();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link
        className="text-sm font-semibold text-blue-600 hover:text-blue-700"
        to={`/orgs/${orgId}`}
      >
        Back to organization
      </Link>
      <section className="panel mt-5 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-950 px-8 py-7 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">
            Project workspace
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">
            Document viewer coming in Phase 1
          </h1>
        </div>
        <div className="grid gap-6 p-8 md:grid-cols-[1fr_320px]">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              PlanSimple document coordination
            </h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              This project route is ready for the upcoming viewer, markups, and
              collaborative review tools.
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
            <p>
              <span className="font-semibold text-slate-700">Organization:</span>{" "}
              {orgId}
            </p>
            <p className="mt-2">
              <span className="font-semibold text-slate-700">Project:</span>{" "}
              {projectId}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
