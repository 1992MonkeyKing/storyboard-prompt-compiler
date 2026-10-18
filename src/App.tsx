import { useEffect, useRef, useState } from 'react';
import { defaultPlatformId, loadExampleProject, newProject } from './ui/project';
import { loadSavedProject, saveProject } from './ui/storage';
import { listPlatforms } from './lib/compile';
import type { Card, Project, Shot } from './lib/types';
import { buildCsv, buildTxt, downloadFile, parseProjectJson, projectJsonText } from './ui/export';
import TopBar from './ui/components/TopBar';
import CardsPanel from './ui/components/CardsPanel';
import AssetsPanel from './ui/components/AssetsPanel';
import ShotsPanel from './ui/components/ShotsPanel';
import ShotEditor from './ui/components/ShotEditor';
import Preview from './ui/components/Preview';
import ImportModal from './ui/components/ImportModal';

export default function App() {
  const [project, setProject] = useState<Project>(() => loadSavedProject() ?? newProject());
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [platformId, setPlatformId] = useState<string>(() => defaultPlatformId());
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const projectFileRef = useRef<HTMLInputElement | null>(null);

  // 数据自动保存到浏览器本地
  useEffect(() => {
    const t = window.setTimeout(() => {
      saveProject(project);
      setSavedAt(Date.now());
    }, 400);
    return () => window.clearTimeout(t);
  }, [project]);

  const selectedShot = project.shots.find((s) => s.id === selectedShotId) ?? null;

  /** 选中镜头时，平台自动切到与镜头类型匹配的模板 */
  const selectShot = (id: string) => {
    setSelectedShotId(id);
    const shot = project.shots.find((s) => s.id === id);
    if (shot) {
      const match = listPlatforms().find((t) => t.kind === shot.kind);
      if (match) setPlatformId(match.id);
    }
  };

  const loadExample = () => {
    const p = loadExampleProject();
    setProject(p);
    const first = p.shots[0] ?? null;
    setSelectedShotId(first ? first.id : null);
    if (first) {
      const match = listPlatforms().find((t) => t.kind === first.kind);
      if (match) setPlatformId(match.id);
    }
  };

  /** 导入拆解 JSON 确认后：合并档案卡与镜头（镜头状态已在弹窗内设为草稿） */
  const handleImportShots = (cards: Card[], shots: Shot[]) => {
    setProject((p) => ({ ...p, cards: [...p.cards, ...cards], shots: [...p.shots, ...shots] }));
    setImportOpen(false);
    const first = shots[0];
    if (first) {
      setSelectedShotId(first.id);
      const match = listPlatforms().find((t) => t.kind === first.kind);
      if (match) setPlatformId(match.id);
    }
  };

  /** 导入项目 JSON 文件：整体替换当前项目 */
  const handleProjectFile = async (file: File) => {
    const imported = parseProjectJson(await file.text());
    if (!imported) {
      window.alert('项目文件不正确（需要合法 JSON，且包含 cards / assets / shots）');
      return;
    }
    if (!window.confirm('导入项目将替换当前全部内容，继续？')) return;
    setProject(imported);
    setSelectedShotId(null);
  };

  const fileStem = project.project.id || 'project';

  return (
    <div className="app">
      <TopBar
        projectName={project.project.name}
        onRename={(name) => setProject({ ...project, project: { ...project.project, name } })}
        onNew={() => {
          if (window.confirm('新建项目将替换当前内容（已自动保存在本地）。继续？')) {
            setProject(newProject());
            setSelectedShotId(null);
          }
        }}
        onLoadExample={() => {
          if (window.confirm('载入示例项目将替换当前内容（已自动保存在本地）。继续？')) {
            loadExample();
          }
        }}
        onOpenImport={() => setImportOpen(true)}
        onImportProject={() => projectFileRef.current?.click()}
        onExportProject={() => downloadFile(`${fileStem}.json`, projectJsonText(project), 'application/json')}
        onExportTxt={() => downloadFile(`${fileStem}-全片.txt`, buildTxt(project), 'text/plain')}
        onExportCsv={() => downloadFile(`${fileStem}-全片.csv`, buildCsv(project), 'text/csv')}
        savedAt={savedAt}
      />
      <input
        ref={projectFileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleProjectFile(f);
          e.target.value = '';
        }}
      />
      {importOpen && (
        <ImportModal
          project={project}
          onClose={() => setImportOpen(false)}
          onImport={handleImportShots}
        />
      )}
      <div className="columns">
        <aside className="col col-left">
          <CardsPanel
            cards={project.cards}
            onChange={(cards) => setProject({ ...project, cards })}
          />
          <AssetsPanel
            assets={project.assets}
            platformId={platformId}
            onChange={(assets) => setProject({ ...project, assets })}
          />
        </aside>
        <aside className="col col-mid">
          <ShotsPanel
            shots={project.shots}
            selectedId={selectedShotId}
            onSelect={selectShot}
            onChange={(shots) => {
              setProject({ ...project, shots });
              if (selectedShotId && !shots.some((s) => s.id === selectedShotId)) {
                setSelectedShotId(null);
              }
            }}
          />
        </aside>
        <section className="col col-right">
          <div className="editor-wrap">
            {selectedShot ? (
              <ShotEditor
                shot={selectedShot}
                cards={project.cards}
                assets={project.assets}
                platformId={platformId}
                onChange={(shot) =>
                  setProject({
                    ...project,
                    shots: project.shots.map((s) => (s.id === shot.id ? shot : s)),
                  })
                }
              />
            ) : (
              <div className="empty-hint editor-empty">← 在中间栏选择或新建一个镜头开始编辑</div>
            )}
          </div>
          <Preview
            project={project}
            shotId={selectedShotId}
            platformId={platformId}
            onPlatformChange={setPlatformId}
          />
        </section>
      </div>
    </div>
  );
}
