interface RenderablePage {
  id: string;
  title: string;
  content_json: unknown;
}

/**
 * Temporary safe-text adapter required for the baseline build.
 * Claude's P2-05 package owns the final versioned block renderer.
 */
export function PageRenderer({ page }: { page: RenderablePage }) {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <article className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {page.title}
        </h1>
        <pre className="mt-8 overflow-auto rounded-xl bg-slate-50 p-4 text-sm whitespace-pre-wrap text-slate-700">
          {JSON.stringify(page.content_json, null, 2)}
        </pre>
      </article>
    </main>
  );
}
