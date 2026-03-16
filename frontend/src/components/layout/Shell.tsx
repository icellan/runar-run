import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { PanelSplit } from './PanelSplit';
import { CodeEditor } from '../editor/CodeEditor';
import { OutputPane } from '../output/OutputPane';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { FileDropZone } from '../editor/FileDropZone';

export function Shell() {
  return (
    <div className="flex flex-col h-full bg-bg">
      <FileDropZone />
      <TopBar />
      <PanelSplit
        left={
          <ErrorBoundary>
            <CodeEditor />
          </ErrorBoundary>
        }
        right={
          <ErrorBoundary>
            <OutputPane />
          </ErrorBoundary>
        }
        defaultLeftPercent={45}
      />
      <StatusBar />
    </div>
  );
}
