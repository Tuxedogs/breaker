import { Link, useParams } from "react-router-dom";

type WipPageProps = {
  section: "Ships" | "Systems";
};

function toDisplayName(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function WipPage({ section }: WipPageProps) {
  const params = useParams();
  const slug = params.shipId ?? params.systemId ?? "wip";

  return (
    <section className="route-fade flex min-h-[calc(100vh-7.5rem)] items-center justify-center py-10">
      <div className="w-full max-w-2xl rounded-2xl border border-white/20 bg-black/35 p-8 text-center backdrop-blur-xl">
        <p className="title-font text-xs uppercase tracking-[0.24em] text-slate-300">{section}</p>
        <h1 className="title-font mt-4 text-3xl text-white sm:text-4xl">{toDisplayName(slug)}</h1>
        <p className="mt-4 text-slate-300">WIP</p>
        <Link
          to="/framework"
          className="mt-8 inline-block rounded-lg border border-white/30 bg-white/8 px-5 py-2 text-sm uppercase tracking-[0.18em] text-slate-100 transition hover:border-white/50 hover:bg-white/12"
        >
          Back to Framework
        </Link>
      </div>
    </section>
  );
}
