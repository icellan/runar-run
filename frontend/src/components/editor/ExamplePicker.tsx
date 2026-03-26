import { useMemo } from 'react';
import { useEditor } from '../../contexts/EditorContext';
import { EXAMPLES } from '../../examples';

export function ExamplePicker() {
  const { language, source, loadExample } = useEditor();

  const filtered = useMemo(
    () => EXAMPLES.filter((e) => e.language === language),
    [language],
  );

  const currentId = useMemo(
    () => filtered.find((e) => e.source === source)?.id ?? '',
    [filtered, source],
  );

  return (
    <select
      value={currentId}
      onChange={(e) => {
        if (e.target.value) {
          loadExample(e.target.value);
        }
      }}
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
      <option value="">
        {filtered.length === 0 ? 'No examples' : 'Examples'}
      </option>
      {filtered.map((example) => (
        <option key={example.id} value={example.id}>
          {example.name}
        </option>
      ))}
    </select>
  );
}
