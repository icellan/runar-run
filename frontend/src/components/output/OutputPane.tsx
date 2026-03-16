import { useState } from 'react';
import { TabStrip } from '../shared/TabStrip';
import { AstTab } from './AstTab';
import { IrTab } from './IrTab';
import { ScriptTab } from './ScriptTab';
import { ExecutionTab } from './ExecutionTab';
import { DeployTab } from './DeployTab';

const TABS = [
  { id: 'ast', label: 'AST' },
  { id: 'ir', label: 'IR' },
  { id: 'script', label: 'Script' },
  { id: 'execution', label: 'Execution' },
  { id: 'deploy', label: 'Deploy & Call' },
];

export function OutputPane() {
  const [activeTab, setActiveTab] = useState('execution');

  return (
    <div className="h-full flex flex-col bg-bg">
      <TabStrip tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'ast' && <AstTab />}
        {activeTab === 'ir' && <IrTab />}
        {activeTab === 'script' && <ScriptTab />}
        {activeTab === 'execution' && <ExecutionTab />}
        {activeTab === 'deploy' && <DeployTab />}
      </div>
    </div>
  );
}
