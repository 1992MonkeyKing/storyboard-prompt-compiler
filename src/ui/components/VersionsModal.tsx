// 阶段 4：版本对比弹窗。任选两个版本（或“当前编辑”），按句对比提示词差异。
import { useMemo, useState } from 'react';
import { listPlatforms } from '../../lib/compile';
import type { Project, Shot } from '../../lib/types';
import { compileForKind, diffSentences, versionsOf } from '../versions';

interface Props {
  project: Project;
  shot: Shot;
  platformId: string;
  onClose: () => void;
}

const CURRENT = 'current';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('zh-CN', { hour12: false });
}

export default function VersionsModal({ project, shot, platformId, onClose }: Props) {
  const versions = versionsOf(project, shot.id);
  const platforms = listPlatforms().filter((t) => t.kind === shot.kind);
  const [pid, setPid] = useState(
    platforms.some((t) => t.id === platformId) ? platformId : (platforms[0]?.id ?? ''),
  );
  const last = versions[versions.length - 1];
  const [left, setLeft] = useState<string>(last ? String(last.n) : CURRENT);
  const [right, setRight] = useState<string>(CURRENT);

  const current = useMemo(() => compileForKind(project, shot), [project, shot]);
  const textOf = (key: string): string => {
    if (key === CURRENT) return current[pid] ?? '';
    return versions.find((v) => String(v.n) === key)?.prompts[pid] ?? '';
  };
  const ops = diffSentences(textOf(left), textOf(right));
  const changed = ops.filter((o) => o.type !== 'same').length;

  const options = [
    ...versions.map((v) => ({ value: String(v.n), label: `v${v.n} · ${formatTime(v.savedAt)}` })),
    { value: CURRENT, label: '当前编辑内容' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="panel-title">
            版本对比 · {shot.id} {shot.label}
          </span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="modal-body">
          {versions.length === 0 ? (
            <p className="modal-hint">
              这个镜头还没有定稿版本。把状态设为“定稿”时会自动保存一个版本，之后可以在这里对比。
            </p>
          ) : (
            <>
              <div className="version-bar">
                <label>
                  旧
                  <select value={left} onChange={(e) => setLeft(e.target.value)}>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="version-arrow">→</span>
                <label>
                  新
                  <select value={right} onChange={(e) => setRight(e.target.value)}>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                {platforms.length > 1 && (
                  <select value={pid} onChange={(e) => setPid(e.target.value)} aria-label="对比平台">
                    {platforms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
                <span className="version-count">{changed === 0 ? '两者完全相同' : `${changed} 处变化`}</span>
              </div>
              <div className="version-diff">
                {ops.map((o, i) => (
                  <div key={i} className={`diff-line diff-${o.type}`}>
                    <span className="diff-mark">{o.type === 'added' ? '+' : o.type === 'removed' ? '−' : ' '}</span>
                    {o.text}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
