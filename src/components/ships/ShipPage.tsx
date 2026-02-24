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
    <section className="ship-framework route-fade pb-8 pt-2">
      <div className="mx-auto max-w-[1180px] space-y-6">
        <article className={`framework-modern-card framework-modern-card-${accent === "amber" ? "ships" : "systems"} ship-framework-block rounded-[1.9rem] border p-4 sm:p-6 ${panelSurfaceClass} ${s.border}`}>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="framework-modern-card-head rounded-[1.4rem] border border-white/18 p-5 sm:p-6">
              <p className="framework-modern-kicker">Ship Manual</p>
              <h1 className={`title-font mt-2 text-4xl tracking-[0.07em] sm:text-5xl ${s.title}`}>{data.name}</h1>
              <p className={`mt-2 text-xl ${s.soft}`}>{data.tagLine}</p>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-200 sm:text-lg">{data.summary}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {data.criticalNotes.map((note) => {
                  const stateStyles = getCalloutStateStyles(note.status);
                  return (
                    <article
                      key={note.title}
                      className={`framework-modern-row ship-framework-note rounded-xl border p-3 ${subPanelSurfaceClass} ${stateStyles.cardBorderClass}`}
                      style={{ boxShadow: `inset 0 0 0 1px ${stateStyles.edgeColor}` }}
                    >
                      <h2 className={`title-font text-[0.65rem] uppercase tracking-[0.16em] ${stateStyles.titleClass}`}>
                        {note.title}
                      </h2>
                      <p className={`mt-2 inline-flex rounded-md border px-2 py-1 text-[0.7rem] uppercase tracking-[0.12em] ${stateStyles.panelClass}`}>
                        {note.status}
                      </p>
                      <ul className={`mt-2 space-y-1 text-sm ${stateStyles.lowerTextClass}`}>
                        {note.points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="framework-modern-card-head relative overflow-hidden rounded-[1.4rem] border border-white/18">
              <video
                ref={videoRef}
                className="h-full w-full aspect-[4/3] object-cover lg:aspect-auto"
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
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
              <p className="pointer-events-none absolute inset-x-5 top-4 text-sm uppercase tracking-[0.16em] text-white/90">
                {videoCaption}
              </p>
              <button
                type="button"
                onClick={togglePlayback}
                className="absolute bottom-4 left-4 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-white/45 bg-black/55 text-white"
                aria-label={isPlaying ? "Pause video" : "Play video"}
              >
                {isPlaying ? (
                  <span className="inline-flex gap-1.5">
                    <span className="h-5 w-[3px] bg-white" />
                    <span className="h-5 w-[3px] bg-white" />
                  </span>
                ) : (
                  <span className="ml-0.5 inline-block h-0 w-0 border-y-[9px] border-y-transparent border-l-[15px] border-l-white" />
                )}
              </button>
            </section>
          </div>
        </article>

        <article className={`framework-modern-card framework-modern-card-${accent === "amber" ? "ships" : "systems"} ship-framework-block rounded-[1.9rem] border p-4 sm:p-6 ${panelSurfaceClass} ${s.border}`}>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="framework-modern-card-head rounded-[1.2rem] border border-white/15 p-5">
              <h2 className={`title-font text-2xl tracking-[0.06em] ${s.title}`}>Overview</h2>
              <p className="mt-4 text-base leading-relaxed text-slate-200">{data.overview}</p>

              <h2 className={`title-font mt-8 text-2xl tracking-[0.06em] ${s.title}`}>Crew Roles</h2>
              <div className="mt-4 space-y-3">
                {data.crewRoles.map((role) => (
                  <div key={role.title} className={`framework-modern-row rounded-lg border border-white/15 p-4 ${subPanelSurfaceClass}`}>
                    <h3 className={`title-font text-xs uppercase tracking-[0.16em] ${s.soft}`}>{role.title}</h3>
                    <p className="mt-2 text-base leading-relaxed text-slate-200">{role.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="framework-modern-card-head rounded-[1.2rem] border border-white/15 p-5">
              <h2 className={`title-font text-2xl tracking-[0.06em] ${s.title}`}>Piloting</h2>
              <p className="mt-4 text-base leading-relaxed text-slate-200">{data.pilotingSummary}</p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-base leading-relaxed text-slate-200">
                {data.relativeTracking.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              <h2 className={`title-font mt-8 text-2xl tracking-[0.06em] ${s.title}`}>Positioning & Range</h2>
              <ul className="mt-4 space-y-2 text-base leading-relaxed text-slate-200">
                {data.positioning.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <h2 className={`title-font mt-8 text-2xl tracking-[0.06em] ${s.title}`}>
                Loadout -{" "}
                <a href={data.loadoutLinkUrl ?? "#"} target="_blank" rel="noreferrer" className="text-cyan-300">
                  {data.loadoutLinkLabel ?? "spviewer"}
                </a>
              </h2>
              <ul className="mt-4 grid gap-x-7 gap-y-2 text-base leading-relaxed text-slate-200 sm:grid-cols-2">
                {data.loadout.map((item) => (
                  <li key={item} className="ml-5 list-disc">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </article>

        <article className={`framework-modern-card framework-modern-card-${accent === "amber" ? "ships" : "systems"} ship-framework-block rounded-[1.9rem] border p-5 sm:p-6 ${panelSurfaceClass} ${s.border}`}>
          <h2 className={`title-font text-2xl tracking-[0.06em] ${s.title}`}>General Rules</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-slate-200">
            {data.generalRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
