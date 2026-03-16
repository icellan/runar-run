import { useEffect, useRef } from 'react';

interface DocsModalProps {
  open: boolean;
  onClose: () => void;
}

export function DocsModal({ open, onClose }: DocsModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="relative w-full max-w-3xl max-h-[85vh] mx-4 bg-surface border border-border rounded-xl shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-text">Playground Documentation</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded text-text-tertiary
                       hover:text-text hover:bg-neutral-700 transition-colors"
          >
            &#x2715;
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto px-6 py-5 docs-content">
          <Section title="Overview">
            <p>
              The Rúnar Playground is an interactive browser-based IDE for writing, compiling, and
              debugging Rúnar smart contracts for Bitcoin SV. Everything runs in your browser — there
              is no backend server involved in compilation or execution. The compiler and script
              executor run inside Web Workers so the UI stays responsive.
            </p>
          </Section>

          <Section title="Supported Languages">
            <p>
              Rúnar contracts can be written in six languages. Use the language selector in the
              top bar to switch between them:
            </p>
            <ul>
              <li><strong>TypeScript</strong> — Primary language, most examples use this</li>
              <li><strong>Solidity</strong> — Solidity-flavored syntax</li>
              <li><strong>Move</strong> — Move-flavored syntax</li>
              <li><strong>Python</strong> — Python-flavored syntax</li>
              <li><strong>Go</strong> — Go-flavored syntax</li>
              <li><strong>Rust</strong> — Rust-flavored syntax</li>
            </ul>
            <p>
              All languages compile to the same Bitcoin Script output. The language choice only
              affects surface syntax — the compilation pipeline, debugger, and all output views
              work identically regardless of language.
            </p>
          </Section>

          <Section title="Layout">
            <p>The playground has a two-pane layout with a resizable divider:</p>
            <ul>
              <li>
                <strong>Left pane — Code Editor:</strong> A Monaco-based editor where you write
                your contract. It supports syntax highlighting and auto-completion. Below the editor,
                you'll see the <em>Constructor Args</em> panel, which auto-detects the contract's
                constructor parameters and lets you edit their values.
              </li>
              <li>
                <strong>Right pane — Output:</strong> Four tabs showing the compilation and
                execution output (AST, IR, Script, Execution).
              </li>
            </ul>
          </Section>

          <Section title="Workflow">
            <ol>
              <li>
                <strong>Write or load a contract.</strong> Type in the editor, select an example
                from the dropdown, or drag-and-drop a <code>.runar.ts</code> (or other extension)
                file onto the window.
              </li>
              <li>
                <strong>Compilation happens automatically.</strong> After a 600ms debounce,
                the compiler runs in a Web Worker. The status bar at the bottom shows the
                compilation state and error count.
              </li>
              <li>
                <strong>Configure constructor arguments.</strong> The Constructor Args panel below
                the editor auto-detects your contract's properties. Edit values as needed — they're
                baked into the compiled locking script.
              </li>
              <li>
                <strong>Inspect compilation output.</strong> Use the AST, IR, and Script tabs to
                examine the compiler's intermediate representations and final Bitcoin Script output.
              </li>
              <li>
                <strong>Debug execution.</strong> Switch to the Execution tab. The playground
                auto-generates a valid unlocking script (including real ECDSA signatures) and
                executes it against the locking script. Step through each opcode, inspect the
                stack, and verify your contract logic.
              </li>
              <li>
                <strong>Share your work.</strong> Click the Share button to encode the current
                source and language into a URL. The link is copied to your clipboard and can be
                shared with anyone.
              </li>
            </ol>
          </Section>

          <Section title="Output Tabs">
            <h4>AST (Abstract Syntax Tree)</h4>
            <p>
              Shows the parsed syntax tree of your contract. Expand/collapse nodes to explore the
              structure. Useful for understanding how the parser interprets your code.
            </p>

            <h4>IR (Intermediate Representation)</h4>
            <p>
              Shows the ANF (A-Normal Form) lowered representation — the intermediate step between
              your source code and the final Bitcoin Script. This is the compiler's internal
              representation after type-checking and normalization.
            </p>

            <h4>Script</h4>
            <p>
              The compiled Bitcoin Script output, viewable in three modes:
            </p>
            <ul>
              <li><strong>ASM</strong> — Human-readable opcode mnemonics (e.g., <code>OP_DUP OP_HASH160</code>)</li>
              <li><strong>Hex</strong> — Raw hexadecimal script bytes</li>
              <li>
                <strong>Annotated</strong> — ASM view with source-map annotations showing which
                line of your source code each opcode was generated from
              </li>
            </ul>

            <h4>Execution</h4>
            <p>
              The interactive step-through debugger. This is where you test your contract by
              executing the unlocking script against the locking script.
            </p>
          </Section>

          <Section title="The Debugger">
            <p>
              The Execution tab provides a full step-through debugger for Bitcoin Script. When a
              contract compiles successfully, the playground auto-generates a valid unlocking script
              and immediately executes it.
            </p>

            <h4>Debugger Layout</h4>
            <ul>
              <li>
                <strong>Context bar (top):</strong> Shows the selected method, its arguments, constructor
                arg values, and (for stateful contracts) a locktime input.
              </li>
              <li>
                <strong>Controls:</strong> Reset, Prev, Next, Run (auto-play), speed slider, and
                a "Skip inactive" toggle.
              </li>
              <li>
                <strong>Script panel (left):</strong> Lists all opcodes from both the unlocking
                and locking scripts. The current opcode is highlighted. IF/ELSE/ENDIF blocks are
                indented for readability.
              </li>
              <li>
                <strong>Stack panel (right):</strong> Shows the main stack and alt stack after
                each opcode executes. Items are shown bottom-to-top (newest at bottom). Each item
                shows its hex value, byte length, and where possible, a decoded interpretation
                (e.g., integer value, "true"/"false").
              </li>
              <li>
                <strong>Status bar (bottom):</strong> Shows the current opcode name, step counter,
                and final result (Script valid / Script failed / Error).
              </li>
            </ul>

            <h4>Controls</h4>
            <ul>
              <li><strong>Next / Prev:</strong> Step one opcode forward or back. Also mapped to Left/Right arrow keys.</li>
              <li><strong>Reset:</strong> Return to the initial empty state (before any opcode). Also mapped to the Home key.</li>
              <li><strong>Run:</strong> Auto-play through all opcodes at the selected speed.</li>
              <li><strong>Speed slider:</strong> Controls auto-play speed (50ms to 500ms per step).</li>
              <li>
                <strong>Skip inactive:</strong> When enabled (default), the debugger skips over
                opcodes inside non-taken IF/ELSE branches. This avoids stepping through long blocks
                of code that aren't executed.
              </li>
            </ul>

            <h4>Method Selection</h4>
            <p>
              For contracts with multiple public methods, a dropdown lets you choose which method
              to call. The unlocking script and argument inputs update automatically when you
              switch methods.
            </p>

            <h4>Editable Arguments</h4>
            <p>
              Each method argument can be edited directly in the context bar. Changes are applied
              when you press Enter or click away from the input (blur). For <code>Sig</code>
              arguments, the signer name is shown (e.g., "alice's sig") — the actual ECDSA
              signature is computed at execution time.
            </p>

            <h4>Manual Unlock Script Override</h4>
            <p>
              Expand the "Manual unlock script override" section to paste raw hex bytes as the
              unlocking script, bypassing the auto-generated one. Clear the field to return to
              auto-generation.
            </p>
          </Section>

          <Section title="Constructor Arguments">
            <p>
              The Constructor Args panel below the editor auto-detects properties from your
              contract's AST. When you add or remove constructor parameters in your code, the
              panel updates automatically.
            </p>
            <p>Default values are generated based on the parameter type:</p>
            <ul>
              <li><strong>PubKey</strong> — Alice's test public key</li>
              <li><strong>Ripemd160 / Addr</strong> — Alice's test public key hash</li>
              <li><strong>Sha256</strong> — 32 zero bytes</li>
              <li><strong>bigint</strong> — <code>0</code></li>
              <li><strong>boolean</strong> — <code>true</code></li>
              <li><strong>ByteString</strong> — <code>00</code></li>
            </ul>
            <p>
              Constructor values are baked into the compiled locking script at their byte offsets.
              Changing a constructor value triggers recompilation.
            </p>
          </Section>

          <Section title="Test Keys & Signatures">
            <p>
              The playground uses three pre-generated deterministic test key pairs for creating
              real ECDSA signatures during execution:
            </p>
            <table>
              <thead>
                <tr><th>Name</th><th>Public Key (compressed, hex)</th><th>Role</th></tr>
              </thead>
              <tbody>
                <tr><td>Alice</td><td><code>03a34b...c5bd</code></td><td>Default key for PubKey constructor args</td></tr>
                <tr><td>Bob</td><td><code>03d6bf...1f35</code></td><td>Used for secondary signatures</td></tr>
                <tr><td>Charlie</td><td><code>02c6b7...30ae</code></td><td>Used for third-party signatures</td></tr>
              </tbody>
            </table>

            <h4>Smart Signer Matching</h4>
            <p>
              When generating <code>Sig</code> arguments, the playground tries to match the
              parameter name to a constructor PubKey. For example, if your constructor has
              a <code>sellerPubKey</code> set to Bob's key, and your method has a
              parameter <code>sellerSig</code>, the playground will automatically sign with
              Bob's private key. Name patterns checked:
              <code>PubKey</code>, <code>Pk</code>, <code>Key</code>, <code>pubKey</code>,
              <code>pubkey</code>.
            </p>
            <p>
              If no match is found, signers rotate through Alice, Bob, Charlie in order.
            </p>

            <h4>Bigint Value Generation</h4>
            <p>
              For <code>bigint</code> method arguments, the playground looks for a related
              constructor argument (matching names like "amount", "bid", "value", "price") and
              generates a value of <code>constructor_value + 1</code>. This is useful for contracts
              like Auction where a new bid must exceed the current highest bid.
            </p>
          </Section>

          <Section title="Execution Assumptions">
            <p>
              The debugger simulates a Bitcoin transaction to execute the script. Several mock
              values are used:
            </p>
            <ul>
              <li><strong>Mock satoshis:</strong> The UTXO being spent is assumed to hold 100,000 satoshis.</li>
              <li>
                <strong>Transaction version:</strong> Version 2 (BSV relaxed mode), required for
                stateful contract scripts.
              </li>
              <li><strong>Sequence number:</strong> <code>0xFFFFFFFF</code> (final).</li>
              <li><strong>Previous outpoint:</strong> A deterministic mock hash with index 0.</li>
              <li>
                <strong>Signatures:</strong> Real ECDSA signatures computed using the test keys
                above with BIP-143 sighash (SIGHASH_ALL | FORKID). These are valid cryptographic
                signatures, not mock data.
              </li>
            </ul>

            <h4>Stateful Contracts</h4>
            <p>
              Stateful contracts (extending <code>StatefulSmartContract</code>) require additional
              implicit parameters that the playground handles automatically:
            </p>
            <ul>
              <li>
                <strong>txPreimage:</strong> A BIP-143 sighash preimage constructed from the mock
                transaction parameters.
              </li>
              <li>
                <strong>_opPushTxSig:</strong> An ECDSA signature using private key = 1 (the
                generator point G). This is the "push tx" technique used to validate the preimage
                on-chain.
              </li>
              <li>
                <strong>_codePart:</strong> The locking script prefix before the OP_CODESEPARATOR,
                used for continuation output construction.
              </li>
              <li><strong>_changePKH:</strong> Alice's public key hash (mock change output).</li>
              <li><strong>_changeAmount:</strong> 0 satoshis (mock).</li>
              <li><strong>_newAmount:</strong> 100,000 satoshis (same as mock UTXO).</li>
            </ul>

            <h4>Locktime</h4>
            <p>
              For stateful contracts, a Locktime input appears in the context bar. This sets the
              mock transaction's <code>nLockTime</code> field (interpreted as a block height).
              Useful for testing time-dependent logic — e.g., setting a locktime above or below
              an auction deadline.
            </p>

            <h4>Limitations</h4>
            <ul>
              <li>
                State-mutating methods (e.g., <code>bid</code> on Auction) may fail at the output
                verification step because the mock transaction's <code>hashOutputs</code> won't
                match the expected continuation outputs. You can still step through most of the
                contract logic up to that point.
              </li>
              <li>
                Terminal/read-only stateful methods (e.g., <code>close</code> on Auction) work
                fully, including the complete checkPreimage verification.
              </li>
              <li>There is no state persistence between method calls.</li>
            </ul>
          </Section>

          <Section title="Sharing">
            <p>
              Click the <strong>Share</strong> button in the top bar to encode your current source
              code and language selection into a URL hash. The link is copied to your clipboard
              automatically. Anyone who opens the link will see your exact contract loaded in the
              editor.
            </p>
            <p>
              Sharing uses LZ-string compression — no data is sent to a server. The entire contract
              is encoded in the URL fragment.
            </p>
          </Section>

          <Section title="File Drag & Drop">
            <p>
              Drag a contract file from your file system onto the browser window. The playground
              detects the language from the file extension and loads the contents into the editor.
            </p>
            <p>Recognized extensions:</p>
            <ul>
              <li><code>.runar.ts</code> / <code>.ts</code> — TypeScript</li>
              <li><code>.runar.sol</code> / <code>.sol</code> — Solidity</li>
              <li><code>.runar.move</code> — Move</li>
              <li><code>.runar.py</code> / <code>.py</code> — Python</li>
              <li><code>.runar.go</code> / <code>.go</code> — Go</li>
              <li><code>.runar.rs</code> / <code>.rs</code> — Rust</li>
            </ul>
          </Section>

          <Section title="Keyboard Shortcuts">
            <table>
              <thead>
                <tr><th>Key</th><th>Action</th></tr>
              </thead>
              <tbody>
                <tr><td><Kbd>Right Arrow</Kbd></td><td>Next opcode</td></tr>
                <tr><td><Kbd>Left Arrow</Kbd></td><td>Previous opcode</td></tr>
                <tr><td><Kbd>Home</Kbd></td><td>Reset to initial state</td></tr>
              </tbody>
            </table>
          </Section>

          <Section title="Error Handling">
            <p>
              Compilation errors appear in the Execution tab with line numbers and messages. The
              status bar also shows the error count. If a runtime error occurs during script
              execution, the debugger highlights the failing opcode in red and displays the error
              message in the status bar.
            </p>
            <p>
              The editor, output pane, and root app are each wrapped in independent error
              boundaries. If one pane crashes, the other continues working. Click "Try again"
              to recover.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <h3 className="text-base font-semibold text-text mb-2">{title}</h3>
      <div className="text-sm text-text-secondary leading-relaxed space-y-2 docs-text">
        {children}
      </div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block px-1.5 py-0.5 text-[11px] font-mono bg-neutral-800 border border-border rounded text-text-secondary">
      {children}
    </kbd>
  );
}
