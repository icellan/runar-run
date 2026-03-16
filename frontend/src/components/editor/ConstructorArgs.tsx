import { useEffect } from 'react';
import { useEditor } from '../../contexts/EditorContext';
import { useCompiler } from '../../contexts/CompilerContext';
import { ALICE } from '../../examples/test-keys';

interface PropertyInfo {
  name: string;
  type: { kind: string; name?: string };
  readonly: boolean;
}

/** Generate a sensible default value for a given Rúnar type */
function defaultForType(typeName: string): bigint | boolean | string {
  switch (typeName) {
    case 'bigint': return 0n;
    case 'boolean': return true;
    case 'PubKey': return ALICE.pubKey;
    case 'Ripemd160': return ALICE.pubKeyHash;
    case 'Sig': return '';
    case 'Sha256': return '00'.repeat(32);
    case 'ByteString': return '00';
    case 'Addr': return ALICE.pubKeyHash;
    default: return '00';
  }
}

export function ConstructorArgs() {
  const { constructorArgs, setConstructorArgs } = useEditor();
  const { result } = useCompiler();

  // Auto-detect new properties from the compiled contract AST
  // and add them to constructorArgs with default values
  useEffect(() => {
    if (!result?.contract) return;

    const contract = result.contract as { properties?: PropertyInfo[] };
    const props = contract.properties;
    if (!props || props.length === 0) return;

    let changed = false;
    const next = { ...constructorArgs };

    for (const prop of props) {
      if (!(prop.name in next)) {
        const typeName = prop.type.name ?? prop.type.kind;
        next[prop.name] = defaultForType(typeName);
        changed = true;
      }
    }

    // Remove args that no longer exist in the contract
    for (const key of Object.keys(next)) {
      if (!props.some(p => p.name === key)) {
        delete next[key];
        changed = true;
      }
    }

    if (changed) {
      setConstructorArgs(next);
    }
  }, [result?.contract]); // eslint-disable-line react-hooks/exhaustive-deps

  const entries = Object.entries(constructorArgs);
  if (entries.length === 0) return null;

  const updateArg = (key: string, raw: string) => {
    const next = { ...constructorArgs };

    if (raw === 'true') {
      next[key] = true;
    } else if (raw === 'false') {
      next[key] = false;
    } else if (/^\d+$/.test(raw)) {
      next[key] = BigInt(raw);
    } else {
      next[key] = raw;
    }

    setConstructorArgs(next);
  };

  const displayValue = (v: bigint | boolean | string): string => {
    if (typeof v === 'bigint') return v.toString();
    return String(v);
  };

  const typeLabel = (v: bigint | boolean | string): string => {
    if (typeof v === 'bigint') return 'bigint';
    if (typeof v === 'boolean') return 'bool';
    if (typeof v === 'string' && /^[0-9a-fA-F]*$/.test(v)) return 'hex';
    return 'string';
  };

  return (
    <div className="border-t border-border bg-surface px-3 py-1.5 shrink-0">
      <div className="text-[10px] text-text-tertiary uppercase tracking-wide mb-1">
        Constructor Args
      </div>
      <div className="space-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs text-text-secondary w-24 truncate shrink-0" title={key}>
              {key}
            </span>
            <span className="text-[10px] text-text-tertiary bg-surface-alt px-1 rounded shrink-0">
              {typeLabel(value)}
            </span>
            <input
              type="text"
              value={displayValue(value)}
              onChange={(e) => updateArg(key, e.target.value)}
              className="flex-1 min-w-0 h-6 px-1.5 text-xs font-mono bg-bg border border-border rounded
                         text-text-secondary focus:border-accent-500/50 focus:outline-none transition-colors"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
