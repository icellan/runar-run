interface Tab {
  id: string;
  label: string;
}

interface TabStripProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function TabStrip({ tabs, activeTab, onTabChange }: TabStripProps) {
  return (
    <div className="flex h-8 border-b border-border bg-surface shrink-0">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 text-xs font-medium border-b-2 transition-colors duration-150 ${
              isActive
                ? 'border-accent-500 text-text'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
