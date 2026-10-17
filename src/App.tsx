import { useEffect, useState } from 'react';
import { defaultPlatformId, loadExampleProject, newProject } from './ui/project';
import { loadSavedProject, saveProject } from './ui/storage';
import { listPlatforms } from './lib/compile';
import type { Project } from './lib/types';
import TopBar from './ui/components/TopBar';
import CardsPanel from './ui/components/CardsPanel';
import AssetsPanel from './ui/components/AssetsPanel';
import ShotsPanel from './ui/components/ShotsPanel';
import ShotEditor from './ui/components/ShotEditor';
import Preview from './ui/components/Preview';

export default function App() {
  const [project, setProject] = useState<Project>(() => loadSavedProject() ?? newProject());
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [platformId, setPlatformId] = useState<string>(() => defaultPlatformId());
  const [savedAt, setSavedAt] = useState<number | null>(null);

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
        savedAt={savedAt}
      />
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
