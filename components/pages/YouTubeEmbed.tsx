'use client';

import { Play } from 'lucide-react';
import { useState } from 'react';

export function YouTubeEmbed({
  videoId,
  title,
}: {
  videoId: string;
  title: string;
}) {
  const [consented, setConsented] = useState(false);
  const fallback = `https://www.youtube.com/watch?v=${videoId}`;
  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
      aria-label={`Video: ${title}`}
    >
      {consented ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="aspect-video w-full border-0"
        />
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center">
          <Play size={28} className="text-brand-600" aria-hidden="true" />
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="max-w-md text-xs text-slate-600">
            Playing loads external content from YouTube in privacy-enhanced
            mode.
          </p>
          <button
            type="button"
            onClick={() => setConsented(true)}
            className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-semibold text-white"
          >
            Load video
          </button>
        </div>
      )}
      <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
        <a
          href={fallback}
          target="_blank"
          rel="noreferrer"
          className="text-brand-700 font-semibold underline underline-offset-2"
        >
          Open {title} on YouTube
        </a>
      </p>
    </section>
  );
}
