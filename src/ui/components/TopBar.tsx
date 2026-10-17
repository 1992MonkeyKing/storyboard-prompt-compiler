interface Props {
  projectName: string;
  onRename: (name: string) => void;
  onNew: () => void;
  onLoadExample: () => void;
  savedAt: number | null;
}

export default function TopBar({ projectName, onRename, onNew, onLoadExample, savedAt }: Props) {
  return (
    <header className="topbar">
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
        {savedAt ? `已自动保存 ${new Date(savedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : '自动保存已开启'}
      </span>
    </header>
  );
}
