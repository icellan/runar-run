import { useEditor, type Language } from '../../contexts/EditorContext';

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'solidity', label: 'Solidity' },
  { value: 'move', label: 'Move' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'zig', label: 'Zig' },
];

export function LanguageSelector() {
  const { language, setLanguage } = useEditor();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as Language)}
      className="h-7 px-2 text-xs font-medium bg-surface-alt border border-border rounded-md
                 text-text-secondary cursor-pointer outline-none
                 hover:border-border-strong focus:border-accent-500/50 transition-colors duration-150
                 appearance-none pr-6"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 6px center',
      }}
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.value} value={lang.value}>
          {lang.label}
        </option>
      ))}
    </select>
  );
}
