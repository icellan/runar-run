import { useState, useCallback } from 'react';
import { LanguageSelector } from '../editor/LanguageSelector';
import { ExamplePicker } from '../editor/ExamplePicker';
import { DocsModal } from '../shared/DocsModal';
import { useEditor } from '../../contexts/EditorContext';
import { encodeToHash } from '../../lib/sharing-client';

export function TopBar() {
  const { source, language } = useEditor();
  const [copied, setCopied] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  const handleShare = useCallback(() => {
    const hash = encodeToHash({ source, language });
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;

    // Update URL without reload
    window.history.replaceState(null, '', `#${hash}`);

    // Copy to clipboard
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [source, language]);

  return (
    <header className="flex items-center h-11 px-4 border-b border-border bg-surface shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-6">
        <span className="text-text font-semibold text-base tracking-tight">R<span className="text-accent-500">ú</span>nar</span>
        <span className="text-text-tertiary text-sm font-medium">Playground</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <LanguageSelector />
        <div className="w-px h-5 bg-border" />
        <ExamplePicker />
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={handleShare}
          className="px-3 py-1 text-xs font-medium text-text-secondary border border-border rounded-md
                     hover:border-border-strong hover:text-text transition-all duration-150"
        >
          {copied ? 'Link copied' : 'Share'}
        </button>
        <button
          onClick={() => setDocsOpen(true)}
          className="px-3 py-1 text-xs font-medium text-text-secondary border border-border rounded-md
                     hover:border-border-strong hover:text-text transition-all duration-150"
        >
          Docs
        </button>
      </div>
      <DocsModal open={docsOpen} onClose={() => setDocsOpen(false)} />
    </header>
  );
}
