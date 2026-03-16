import { useCompiler } from '../../contexts/CompilerContext';
import { AstTreeNode } from './AstTreeNode';

export function AstTab() {
  const { result, status } = useCompiler();

  if (status === 'idle') {
    return <EmptyState text="Write a contract to see the AST" />;
  }

  if (!result?.contract) {
    return <EmptyState text="No AST available — check for compilation errors" />;
  }

  return (
    <div className="p-3 font-mono text-xs overflow-auto h-full">
      <AstTreeNode node={result.contract as Record<string, unknown>} depth={0} />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm h-full">
      {text}
    </div>
  );
}
