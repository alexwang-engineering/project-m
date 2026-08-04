export default function Loading() {
  return (
    <main
      className="mx-auto min-h-screen max-w-[1180px] animate-pulse px-8 py-12"
      aria-busy="true"
    >
      <div className="h-8 w-64 rounded-xl bg-slate-200" />
      <div className="mt-8 h-10 rounded-xl bg-slate-200" />
      <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-40 rounded-xl bg-slate-200" />
        ))}
      </div>
      <span className="sr-only">Loading Project M</span>
    </main>
  );
}
