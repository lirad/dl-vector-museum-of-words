// Nice ambient background gradient
export function WallBackground({ dark }: { dark: boolean }) {
  return (
    <div className={`absolute inset-0 -z-10 ${dark ? "bg-zinc-900" : "bg-zinc-50"}`}>
      <div
        className="absolute inset-0"
        style={{
          background:
            dark
              ? "radial-gradient(1200px 600px at 50% 30%, rgba(255,255,255,0.08), rgba(0,0,0,0)), radial-gradient(800px 300px at 10% 80%, rgba(255,255,255,0.06), rgba(0,0,0,0)), radial-gradient(800px 300px at 90% 80%, rgba(255,255,255,0.06), rgba(0,0,0,0))"
              : "radial-gradient(1200px 600px at 50% 30%, rgba(0,0,0,0.05), rgba(255,255,255,0)), radial-gradient(800px 300px at 10% 80%, rgba(0,0,0,0.04), rgba(255,255,255,0)), radial-gradient(800px 300px at 90% 80%, rgba(0,0,0,0.04), rgba(255,255,255,0))",
        }}
      />
      <div className={`absolute inset-0 ${dark ? "bg-gradient-to-b from-transparent to-black/30" : "bg-gradient-to-b from-transparent to-white/50"}`} />
    </div>
  );
}