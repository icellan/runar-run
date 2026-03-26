import { useState, useCallback, useEffect, useRef } from 'react';
import { useEditor, type Language } from '../../contexts/EditorContext';

const EXT_TO_LANGUAGE: Record<string, Language> = {
  '.runar.ts': 'typescript',
  '.runar.sol': 'solidity',
  '.runar.move': 'move',
  '.runar.py': 'python',
  '.runar.go': 'go',
  '.runar.rs': 'rust',
  '.runar.zig': 'zig',
  '.runar.rb': 'ruby',
  '.ts': 'typescript',
  '.sol': 'solidity',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.zig': 'zig',
  '.rb': 'ruby',
};

function detectLanguage(fileName: string): Language {
  for (const [ext, lang] of Object.entries(EXT_TO_LANGUAGE)) {
    if (fileName.endsWith(ext)) return lang;
  }
  return 'typescript';
}

export function FileDropZone() {
  const { setSource, setLanguage } = useEditor();
  const [dragging, setDragging] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // Prevent browser default file handling everywhere
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onDragOver = (e: DragEvent) => {
      preventDefaults(e);
      if (e.dataTransfer?.types.includes('Files')) {
        // Keep showing the overlay while dragging over
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setDragging(true);
      }
    };

    const onDragLeave = (e: DragEvent) => {
      preventDefaults(e);
      // Debounce hiding — only hide if we don't get another dragover quickly
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setDragging(false), 100);
    };

    const onDrop = (e: DragEvent) => {
      preventDefaults(e);
      setDragging(false);
      if (hideTimer.current) clearTimeout(hideTimer.current);

      const file = e.dataTransfer?.files[0];
      if (!file) return;

      const language = detectLanguage(file.name);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result;
        if (typeof text === 'string') {
          setLanguage(language);
          // Use setTimeout to ensure language is set before source triggers compilation
          setTimeout(() => setSource(text), 0);
        }
      };
      reader.readAsText(file);
    };

    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [setSource, setLanguage]);

  if (!dragging) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm pointer-events-none">
      <div className="text-center space-y-2 border-2 border-dashed border-accent-500/40 rounded-xl px-12 py-8">
        <div className="text-accent-400 text-lg font-medium">Drop contract file</div>
        <div className="text-text-secondary text-sm">
          .runar.ts .runar.sol .runar.move .runar.py .runar.go .runar.rs .runar.zig .runar.rb
        </div>
      </div>
    </div>
  );
}
