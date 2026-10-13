export default function Loading() {
  return (
    <main
      className="mx-auto min-h-dvh max-w-[1440px] px-4 py-10 motion-safe:animate-pulse sm:px-8"
      aria-busy="true"
    >
      <div
        aria-hidden="true"
        className="h-12 w-64 max-w-full rounded-lg bg-slate-200"
      />
      <div aria-hidden="true" className="mt-8 h-20 rounded-xl bg-slate-200" />
      <div
        aria-hidden="true"
        className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-40 rounded-xl bg-slate-200" />
        ))}
      </div>
      <span className="sr-only">Loading Project M</span>
    </main>
  );
}
