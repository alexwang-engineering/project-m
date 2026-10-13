import Link from 'next/link';

export function SchoolBrand() {
  return (
    <Link
      href="/"
      aria-label="Project M dashboard"
      className="flex shrink-0 items-center gap-3 text-white focus-visible:outline-white"
    >
      <span
        aria-hidden="true"
        className="from-accent-violet to-brand-500 flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br text-[13px] font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]"
      >
        M
      </span>
      <span className="font-display text-[17px] font-extrabold tracking-[-0.02em] sm:text-[19px]">
        Project M
      </span>
    </Link>
  );
}
