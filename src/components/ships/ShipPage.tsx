import { useRef, useState } from "react";

type ShipCallout = {
  title: string;
  status: string;
  points: string[];
};

type ShipRole = {
  title: string;
  body: string;
};

type ShipPageData = {
  name: string;
  tagLine: string;
  summary: string;
  videoSrc?: string;
  videoPoster?: string;
  videoCaption?: string;
  overview: string;
  pilotingSummary: string;
  relativeTracking: string[];
  criticalNotes: ShipCallout[];
  crewRoles: ShipRole[];
  positioning: string[];
  loadout: string[];
  loadoutLinkUrl?: string;
  loadoutLinkLabel?: string;
  generalRules: string[];
};

type ShipSurfacePreset = {
  panelBgClass: string;
  panelBlurClass: string;
  subPanelBgClass?: string;
  subPanelBlurClass?: string;
};

type ShipPageProps = {
  accent: "amber" | "cyan";
  data: ShipPageData;
  surfacePreset?: ShipSurfacePreset;
};

const accentStyles = {
  amber: {
    border: "border-amber-300/35",
    title: "text-amber-200",
    soft: "text-amber-100/85",
    chip: "bg-amber-300/15 text-amber-100 border-amber-300/40",
    panelGlow: "shadow-[0_0_24px_rgba(255,181,70,0.22)]",
  },
  cyan: {
    border: "border-cyan-300/35",
    title: "text-cyan-200",
    soft: "text-cyan-100/85",
    chip: "bg-cyan-300/15 text-cyan-100 border-cyan-300/40",
    panelGlow: "shadow-[0_0_24px_rgba(78,214,255,0.2)]",
  },
} as const;

export type { ShipPageData };

const defaultSurfacePreset: ShipSurfacePreset = {
  panelBgClass: "bg-black/35",
  panelBlurClass: "backdrop-blur",
  subPanelBgClass: "bg-black/30",
  subPanelBlurClass: "backdrop-blur",
};

export type { ShipSurfacePreset };

function getCalloutStateStyles(status: string) {
  const normalized = status.trim().toLowerCase();

  if (normalized === "blocked") {
    return {
      titleClass: "text-red-300",
      cardBorderClass: "border-red-500/45",
      panelClass: "border-red-500 bg-red-900/30 text-red-300",
      lowerTextClass: "text-red-300",
      edgeColor: "rgba(239, 68, 68, 0.55)",
      glowColor: "rgba(239, 68, 68, 0.25)",
    };
  }

  if (normalized === "caution") {
    return {
      titleClass: "text-orange-400",
      cardBorderClass: "border-orange-400/45",
      panelClass: "border-red-500 bg-red-900/30 text-orange-400",
      lowerTextClass: "text-orange-400",
      edgeColor: "rgba(251, 146, 60, 0.52)",
      glowColor: "rgba(251, 146, 60, 0.22)",
    };
  }

  return {
    titleClass: "text-slate-300",
    cardBorderClass: "border-green-500/45",
    panelClass: "border-green-500/70 bg-green-900/30 text-green-200",
    lowerTextClass: "text-slate-400",
    edgeColor: "rgba(34, 197, 94, 0.48)",
    glowColor: "rgba(34, 197, 94, 0.2)",
  };
}

export default function ShipPage({ accent, data, surfacePreset = defaultSurfacePreset }: ShipPageProps) {
  const s = accentStyles[accent];
  const panelSurfaceClass = `${surfacePreset.panelBgClass} ${surfacePreset.panelBlurClass}`;
  const subPanelSurfaceClass = `${surfacePreset.subPanelBgClass ?? surfacePreset.panelBgClass} ${surfacePreset.subPanelBlurClass ?? surfacePreset.panelBlurClass}`;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoSrc = data.videoSrc ?? "/images/video/percy-position.mp4";
  const videoCaption = data.videoCaption ?? "Combat Profile: Relative Tracking Engagement";

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setIsPlaying(true);
      return;
    }
    video.pause();
    setIsPlaying(false);
  }

  return (
    <section className="route-fade pb-8 pt-2">
      <div className="mx-auto max-w-[1180px] space-y-6">
        <article className={`rounded-2xl border p-5 sm:p-6 ${panelSurfaceClass} ${s.border}`}>
          <section className="px-1 py-1">
            <p className="title-font text-xs uppercase tracking-[0.18em] text-slate-300">Ship Manual</p>
            <h1 className={`title-font mt-2 text-4xl tracking-[0.08em] sm:text-5xl ${s.title}`}>{data.name}</h1>
            <p className={`mt-1 text-2xl ${s.soft}`}>{data.tagLine}</p>
            <p className="mt-4 max-w-5xl text-lg leading-relaxed text-slate-200">{data.summary}</p>
          </section>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {data.criticalNotes.map((note) => {
              const stateStyles = getCalloutStateStyles(note.status);
              return (
                <article
                  key={note.title}
                  className={`rounded-2xl border p-5 text-center sm:p-6 ${panelSurfaceClass} ${stateStyles.cardBorderClass}`}
                >
                  <h2 className={`title-font text-sm uppercase tracking-[0.14em] ${stateStyles.titleClass}`}>{note.title}</h2>
                  <div
                  className={`relative mt-3 overflow-hidden rounded-md border px-3 py-2 text-base font-semibold uppercase tracking-[0.1em] ${stateStyles.panelClass}`}
                    style={{ boxShadow: `0 0 0 1px ${stateStyles.edgeColor} inset, 0 0 12px ${stateStyles.glowColor}` }}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-md"
                      style={{
                        background: `radial-gradient(130% 130% at 50% 50%, rgba(0,0,0,0) 60%, ${stateStyles.edgeColor} 100%)`,
                      }}
                    />
                    <span className="relative z-10 font-bold">{note.status}</span>
                  </div>
                  <ul className={`mt-3 space-y-1 text-base leading-relaxed ${stateStyles.lowerTextClass}`}>
                    {note.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>

          <div
            className="group relative mt-5 overflow-hidden rounded-xl border border-white/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07),0_16px_35px_rgba(0,0,0,0.4)]"
          >
            <video
              ref={videoRef}
              className="h-full w-full aspect-[21/8] object-cover"
              src={videoSrc}
              poster={data.videoPoster}
              muted
              preload="metadata"
              playsInline
              controls={false}
              disablePictureInPicture
              controlsList="noplaybackrate nodownload noremoteplayback nofullscreen"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
            <p className="pointer-events-none absolute inset-x-5 top-4 text-center text-lg text-white/90 sm:text-xl">{videoCaption}</p>
            <button
              type="button"
              onClick={togglePlayback}
              className="absolute bottom-4 left-4 inline-flex h-14 w-14 items-center justify-center rounded-md border border-white/40 bg-black/50 text-white transition hover:bg-black/65 active:opacity-30"
              aria-label={isPlaying ? "Pause video" : "Play video"}
            >
              {isPlaying ? (
                <span className="inline-flex gap-1.5">
                  <span className="h-6 w-[4px] bg-white" />
                  <span className="h-6 w-[4px] bg-white" />
                </span>
              ) : (
                <span className="ml-0.5 inline-block h-0 w-0 border-y-[10px] border-y-transparent border-l-[17px] border-l-white" />
              )}
            </button>
          </div>
        </article>

        <article className={`rounded-2xl border p-5 sm:p-6 ${panelSurfaceClass} ${s.border}`}>
          <div className="grid gap-7 lg:grid-cols-2">
            <div className="space-y-7">
              <section>
                <h2 className={`title-font text-3xl tracking-[0.04em] ${s.title}`}>Overview</h2>
                <p className="mt-4 text-lg leading-normal text-slate-200">{data.overview}</p>
              </section>

              <section>
                <h2 className={`title-font text-3xl tracking-[0.04em] ${s.title}`}>Crew Roles</h2>
                <div className="mt-5 space-y-4">
                  {data.crewRoles.map((role, index) => (
                    <div
                      key={role.title}
                      className={`rounded-xl border border-white/15 p-5 ${subPanelSurfaceClass} ${index < data.crewRoles.length - 1 ? "border-b-white/20" : ""}`}
                    >
                      <h3 className={`title-font text-sm uppercase tracking-[0.16em] ${s.soft}`}>{role.title}</h3>
                      <p className="mt-2 text-lg leading-relaxed text-slate-200">{role.body}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="lg:border-l lg:border-white/15 lg:pl-7">
              <h2 className={`title-font text-3xl tracking-[0.04em] ${s.title}`}>Piloting</h2>
              <p className="mt-4 text-lg leading-normal text-slate-200">{data.pilotingSummary}</p>
              <ol className="mt-5 list-decimal space-y-3 pl-5 text-lg leading-normal text-slate-200">
                {data.relativeTracking.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              <h2 className={`title-font mt-10 text-3xl tracking-[0.04em] ${s.title}`}>Positioning & Range</h2>
              <ul className="mt-4 space-y-3 text-lg leading-normal text-slate-200">
                {data.positioning.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <h2 className={`title-font mt-10 text-3xl tracking-[0.04em] ${s.title}`}>
                Loadout -{" "}
                <a
                  href={data.loadoutLinkUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-300 transition hover:text-cyan-200"
                >
                  {data.loadoutLinkLabel ?? "spviewer"}
                </a>
              </h2>
              <ul className="mt-4 grid gap-x-8 gap-y-3 text-lg leading-normal text-slate-200 sm:grid-cols-2">
                {data.loadout.map((item) => (
                  <li key={item} className="list-disc ml-5">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </article>

        <article className={`rounded-2xl border p-6 sm:p-7 ${panelSurfaceClass} ${s.border}`}>
          <h2 className={`title-font text-3xl tracking-[0.04em] ${s.title}`}>General Rules</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-lg leading-relaxed text-slate-200">
            {data.generalRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
