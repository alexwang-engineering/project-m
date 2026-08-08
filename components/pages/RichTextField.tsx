'use client';

import { useEffect, useRef } from 'react';
import { Bold, Italic, Link as LinkIcon } from 'lucide-react';

import { sanitizeEditorHtml } from '@/lib/html-sanitizer';

interface RichTextFieldProps {
  /** Stable identity for the field - the DOM is only re-synced from `html` when this changes. */
  fieldKey: string;
  html: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  toolbar?: boolean;
}

/**
 * Minimal contentEditable rich-text field. Uncontrolled by design: the DOM
 * is the source of truth while typing (re-setting innerHTML from React
 * state on every keystroke would reset the caret), and `onChange` reports
 * the live innerHTML upward. `document.execCommand` is deprecated but has
 * no replacement with this little code for a three-button toolbar, and
 * every allowed tag it can produce (b/i/a) is in the server sanitizer's
 * allow-list (lib/security.ts).
 */
export function RichTextField({
  fieldKey,
  html,
  onChange,
  placeholder,
  className,
  toolbar = true,
}: RichTextFieldProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html;
    // Intentionally re-syncs only when the field identity changes, not on
    // every keystroke's `html` value - see the component doc comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldKey]);

  function exec(command: string, value?: string) {
    ref.current?.focus();
    document.execCommand(command, false, value);
    // execCommand('bold'/'italic') emits <b>/<i> in most browsers, but the
    // server sanitizer's allow-list (lib/security.ts) only permits
    // <strong>/<em> - normalize immediately so what's saved matches what's
    // shown, instead of silently losing the formatting on save.
    ref.current?.querySelectorAll('b').forEach((el) => {
      const replacement = document.createElement('strong');
      replacement.innerHTML = el.innerHTML;
      el.replaceWith(replacement);
    });
    ref.current?.querySelectorAll('i').forEach((el) => {
      const replacement = document.createElement('em');
      replacement.innerHTML = el.innerHTML;
      el.replaceWith(replacement);
    });
    onChange(ref.current?.innerHTML ?? '');
  }

  function insertLink() {
    const input = window.prompt('Link URL');
    if (!input) return;
    try {
      const url = new URL(input, window.location.origin);
      if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return;
      exec('createLink', input);
    } catch {
      return;
    }
  }

  function paste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const clipboard = event.clipboardData;
    const html = clipboard.getData('text/html');
    if (html) exec('insertHTML', sanitizeEditorHtml(html));
    else exec('insertText', clipboard.getData('text/plain'));
  }

  return (
    <div className="focus-within:border-brand-400 rounded-lg border border-slate-200 bg-white">
      {toolbar && (
        <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('bold')}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Bold"
          >
            <Bold size={14} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('italic')}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Italic"
          >
            <Italic size={14} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertLink}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Insert link"
          >
            <LinkIcon size={14} strokeWidth={2.4} />
          </button>
        </div>
      )}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onPaste={paste}
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        className={
          className ??
          'min-h-[44px] px-3 py-2 text-[14px] leading-relaxed text-slate-800 outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]'
        }
      />
    </div>
  );
}
