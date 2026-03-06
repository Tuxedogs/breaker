function DiscordIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-8 w-8 text-cyan-200">
      <path
        fill="currentColor"
        d="M20.32 4.37A19.8 19.8 0 0 0 15.46 3c-.22.38-.48.88-.66 1.28a18.4 18.4 0 0 0-5.6 0A13.2 13.2 0 0 0 8.54 3c-1.7.29-3.33.75-4.86 1.37C.83 8.66.07 12.83.45 16.95a19.9 19.9 0 0 0 5.97 3.05c.49-.66.92-1.37 1.29-2.11-.71-.27-1.4-.61-2.05-1 .17-.13.34-.27.5-.41 3.95 1.86 8.26 1.86 12.16 0 .17.14.34.28.5.41-.65.39-1.34.73-2.05 1 .37.74.8 1.45 1.29 2.11a19.8 19.8 0 0 0 5.97-3.05c.45-4.78-.77-8.92-3.71-12.58ZM8.93 14.48c-1.16 0-2.1-1.06-2.1-2.36s.93-2.36 2.1-2.36c1.16 0 2.11 1.06 2.1 2.36 0 1.3-.94 2.36-2.1 2.36Zm6.14 0c-1.16 0-2.1-1.06-2.1-2.36s.93-2.36 2.1-2.36c1.16 0 2.1 1.06 2.1 2.36 0 1.3-.94 2.36-2.1 2.36Z"
      />
    </svg>
  );
}

function TeamspeakIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-8 w-8 text-blue-200">
      <path
        fill="currentColor"
        d="M3 6.75A2.75 2.75 0 0 1 5.75 4h12.5A2.75 2.75 0 0 1 21 6.75v7.5A2.75 2.75 0 0 1 18.25 17H12.5v2.5a.5.5 0 0 1-.8.4l-3.87-2.9H5.75A2.75 2.75 0 0 1 3 14.25v-7.5Zm3.75.75a.75.75 0 1 0 0 1.5H9.5v4.25a.75.75 0 0 0 1.5 0V9h2.75a.75.75 0 0 0 0-1.5h-7Z"
      />
    </svg>
  );
}

export default function TraditionalModulePage() {
  return (
    <section className="route-fade py-3">
      <div className="space-y-5">
        <article className="framework-modern-card framework-modern-card-systems framework-modern-card-compact rounded-[1.5rem] p-4 sm:p-6">
          <header className="framework-modern-card-head rounded-xl p-5">
            <p className="framework-modern-kicker">Communications Module</p>
            <h1 className="title-font mt-2 text-3xl text-cyan-100 sm:text-4xl">Discord &amp; Teamspeak</h1>
            <p className="mt-3 rounded-lg border border-cyan-200/35 bg-cyan-950/45 px-3 py-2 text-base text-cyan-50">
              Where and when
            </p>
          </header>
        </article>

        <article className="framework-modern-card framework-modern-card-systems framework-modern-card-compact rounded-[1.5rem] p-4 sm:p-6">
          <section className="framework-modern-card-head rounded-xl p-4 sm:p-5">
            <h2 className="title-font text-xl text-cyan-100">Entry Points</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <a
                href="https://discord.gg/join-ares"
                target="_blank"
                rel="noreferrer"
                className="framework-modern-row min-h-11 rounded-xl p-4 transition hover:border-cyan-300/55 hover:bg-cyan-300/10"
              >
                <div className="flex items-center gap-3">
                  <DiscordIcon />
                  <div>
                    <p className="title-font text-lg text-cyan-100">Discord</p>
                    <p className="text-sm text-slate-300">Join Ares Discord</p>
                  </div>
                </div>
              </a>
              <a
                href="https://www.teamspeak.com/en/downloads/"
                target="_blank"
                rel="noreferrer"
                className="framework-modern-row min-h-11 rounded-xl p-4 transition hover:border-blue-300/55 hover:bg-blue-300/10"
              >
                <div className="flex items-center gap-3">
                  <TeamspeakIcon />
                  <div>
                    <p className="title-font text-lg text-cyan-100">Teamspeak</p>
                    <p className="text-sm text-slate-300">Download Client</p>
                  </div>
                </div>
              </a>
            </div>
          </section>
        </article>

        <article className="framework-modern-card framework-modern-card-systems framework-modern-card-compact rounded-[1.5rem] p-4 sm:p-6">
          <section className="framework-modern-card-head rounded-xl p-5">
            <h2 className="title-font text-xl text-cyan-100">Why Both Platforms</h2>
            <p className="mt-3 text-base leading-relaxed text-slate-200">
              Discord is a decent tool but lacks many features. When voice comms need to be split, Teamspeak provides
              whisper lists that can be set on a client-by-client basis, allowing for extremely high levels of
              customization.
            </p>
            <p className="mt-3 text-base leading-relaxed text-slate-200">
              Crews will have a lot of chatter, so it is best to avoid clogging the channel that the main group is in.
              This problem runs both ways, with a crew being unable to communicate while main-group comms are high
              traffic.
            </p>
          </section>
        </article>

        <article className="framework-modern-card framework-modern-card-systems framework-modern-card-compact rounded-[1.5rem] p-4 sm:p-6">
          <section className="framework-modern-card-head rounded-xl p-5">
            <h2 className="title-font text-xl text-cyan-100">Communication Structure Example</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-950/25 p-4">
                <p className="title-font text-base uppercase tracking-[0.14em] text-cyan-100">Main Discord</p>
                <p className="mt-2 text-sm text-slate-200">Command, Fighters, Else</p>
              </div>
              <div className="rounded-xl border border-blue-300/25 bg-blue-950/20 p-4">
                <p className="title-font text-base uppercase tracking-[0.14em] text-blue-100">Teamspeak</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-200">
                  <li>Command - Retransmitting from Discord / Tasking Individually</li>
                  <li>Pilot1 of MC -&gt; Crew</li>
                  <li>Pilot2 of MC -&gt; Crew</li>
                </ul>
              </div>
            </div>
            <p className="mt-4 text-base leading-relaxed text-slate-200">
              This map ensures pilots of all three groups can filter communications, maintaining important information
              from command as well as other MC pilots. Crews can remain in Discord or mute it entirely while still
              communicating with their ship or the channels above them.
            </p>
          </section>
        </article>
      </div>
    </section>
  );
}
