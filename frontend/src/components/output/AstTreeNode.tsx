import { useState } from 'react';

interface AstTreeNodeProps {
  node: Record<string, unknown>;
  depth: number;
  label?: string;
}

const KIND_COLORS: Record<string, string> = {
  contract: 'bg-accent-500/20 text-accent-400',
  property: 'bg-info/20 text-info',
  method: 'bg-success/20 text-success',
  param: 'bg-purple-500/20 text-purple-400',
  primitive_type: 'bg-neutral-500/20 text-neutral-300',
  custom_type: 'bg-neutral-500/20 text-neutral-300',
  fixed_array_type: 'bg-neutral-500/20 text-neutral-300',
  variable_decl: 'bg-info/20 text-info',
  assignment: 'bg-warning/20 text-warning',
  if_statement: 'bg-danger/20 text-danger',
  for_statement: 'bg-danger/20 text-danger',
  return_statement: 'bg-danger/20 text-danger',
  expression_statement: 'bg-neutral-500/20 text-neutral-300',
  binary_expr: 'bg-neutral-500/20 text-neutral-300',
  unary_expr: 'bg-neutral-500/20 text-neutral-300',
  call_expr: 'bg-accent-500/20 text-accent-400',
  identifier: 'bg-info/20 text-info',
  bigint_literal: 'bg-success/20 text-success',
  bool_literal: 'bg-success/20 text-success',
  bytestring_literal: 'bg-success/20 text-success',
  property_access: 'bg-info/20 text-info',
  member_expr: 'bg-info/20 text-info',
};

export function AstTreeNode({ node, depth, label }: AstTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 3);

  const kind = String(node['kind'] ?? 'unknown');
  const name = node['name'] as string | undefined;
  const loc = node['sourceLocation'] as { line?: number; column?: number } | undefined;

  // Collect child arrays/objects for expandability
  const childEntries: { key: string; value: unknown }[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'kind' || key === 'sourceLocation') continue;
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      childEntries.push({ key, value });
    } else if (typeof value === 'object' && value !== null && 'kind' in (value as Record<string, unknown>)) {
      childEntries.push({ key, value });
    }
  }

  const hasChildren = childEntries.length > 0;
  const colorClass = KIND_COLORS[kind] ?? 'bg-neutral-500/20 text-neutral-300';

  // Leaf value display
  const leafValues: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'kind' || key === 'sourceLocation') continue;
    if (typeof value === 'string' && key !== 'sourceFile') {
      leafValues.push(`${key}: "${value}"`);
    } else if (typeof value === 'boolean') {
      leafValues.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      leafValues.push(`${key}: ${value}`);
    }
  }

  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <div
        className="flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-white/[0.03] rounded px-1 -mx-1"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand/collapse indicator */}
        {hasChildren ? (
          <span className="text-text-tertiary w-3 text-center shrink-0">
            {expanded ? '\u25BE' : '\u25B8'}
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Label (if array child) */}
        {label && <span className="text-text-tertiary">{label}:</span>}

        {/* Kind badge */}
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass}`}>
          {kind}
        </span>

        {/* Name */}
        {name && <span className="text-text font-medium">{name}</span>}

        {/* Leaf values */}
        {leafValues.map((lv, i) => (
          <span key={i} className="text-text-secondary">{lv}</span>
        ))}

        {/* Source location */}
        {loc && (
          <span className="text-text-tertiary ml-auto text-[10px]">
            {loc.line}:{loc.column}
          </span>
        )}
      </div>

      {expanded &&
        childEntries.map(({ key, value }) => {
          if (Array.isArray(value)) {
            return value.map((item, i) => (
              <AstTreeNode
                key={`${key}-${i}`}
                node={item as Record<string, unknown>}
                depth={depth + 1}
                label={`${key}[${i}]`}
              />
            ));
          }
          return (
            <AstTreeNode
              key={key}
              node={value as Record<string, unknown>}
              depth={depth + 1}
              label={key}
            />
          );
        })}
    </div>
  );
}
