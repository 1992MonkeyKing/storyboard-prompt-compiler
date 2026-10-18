
import { buildBreakdownPrompt } from '../breakdown';
import { copyText } from '../export';
import { useState } from 'react';

interface Props {
  projectName: string;
  onRename: (name: string) => void;
  onNew: () => void;
  onLoadExample: () => void;
  onOpenImport: () => void;
  onImportProject: () => void;
  onExportProject: () => void;
  onExportTxt: () => void;
  onExportCsv: () => void;
  savedAt: number | null;
}

export default function TopBar(props: Props) {
  const { projectName, onRename, onNew, onLoadExample, savedAt } = props;
  const [copied, setCopied] = useState(false);
  return (
    <header className="topbar">
      <div className="topbar-row">
        <span className="app-title">分镜提示词编译器</span>
        <input
          className="project-name"
          type="text"
          value={projectName}
          onChange={(e) => onRename(e.target.value)}
          placeholder="项目名称"
        />
        <span className="topbar-spacer" />
        <button type="button" className="btn" onClick={onNew}>
          新建项目
        </button>
        <button type="button" className="btn" onClick={onLoadExample}>
          载入示例项目
        </button>
        <span className="save-hint">
          {savedAt
            ? `已自动保存 ${new Date(savedAt).toLocaleTimeString('zh-CN', { hour12: false })}`
            : '自动保存已开启'}
        </span>
      </div>
      <div className="topbar-row topbar-row2">
        <button type="button" className="btn btn-small" onClick={props.onOpenImport}>
          导入拆解JSON
        </button>
        <button type="button" className="btn btn-small" onClick={props.onImportProject}>
          导入项目
        </button>
        <button type="button" className="btn btn-small" onClick={props.onExportProject}>
          导出项目
        </button>
        <button type="button" className="btn btn-small" onClick={props.onExportTxt}>
          导出TXT
        </button>
        <button type="button" className="btn btn-small" onClick={props.onExportCsv}>
          导出CSV
        </button>
        <button
          type="button"
          className="btn btn-small"
          onClick={async () => {
            if (await copyText(buildBreakdownPrompt())) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? '已复制 ✓' : '复制拆解提示词'}
        </button>
      </div>
    </header>
  );
}
