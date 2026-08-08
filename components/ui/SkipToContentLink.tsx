/** Shared skip-to-content link. Target page must give its <main> id="main-content". */
export function SkipToContentLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-slate-900 focus:shadow-lg"
    >
      Skip to main content
    </a>
  );
}
