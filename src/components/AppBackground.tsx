export default function AppBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url("/images/bg-states/bg-image-main.png")' }}
      />
      <div className="app-vignette absolute inset-0" />
      <div className="app-placeholder-box absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-xl" />
      <div className="app-grain absolute inset-0" />
    </div>
  );
}
