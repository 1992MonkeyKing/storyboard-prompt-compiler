import { useState } from 'react';
import type { Shot, VideoShot } from '../../lib/types';
import appOptions from '../appOptions.json';
import { blankShot, moveItem, uid } from '../project';

interface Props {
  shots: Shot[];
  selectedId: string | null;
  /** 每个镜头的校验提示数量（阶段 4），0 或缺省不显示角标 */
  hintCounts?: Record<string, number>;
  onSelect: (id: string) => void;
  onChange: (shots: Shot[]) => void;
}

function shotSub(s: Shot): string {
  if (s.kind === 'video') {
    const v = s as VideoShot;
    return `${v.segments.length} 分段 · ${v.duration} 秒`;
  }
  return '单画面';
}

export default function ShotsPanel({ shots, selectedId, hintCounts, onSelect, onChange }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const duplicate = (id: string) => {
    const src = shots.find((s) => s.id === id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src)) as Shot;
    copy.id = uid('shot');
    copy.label = `${src.label} 副本`;
    copy.status = appOptions.shotStatus[0].value as Shot['status'];
    const idx = shots.findIndex((s) => s.id === id);
    const next = shots.slice();
    next.splice(idx + 1, 0, copy);
    onChange(next);
    onSelect(copy.id);
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">镜头</span>
        <span>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              const s = blankShot('video');
              onChange([...shots, s]);
              onSelect(s.id);
            }}
          >
            ＋ 视频
          </button>{' '}
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              const s = blankShot('image');
              onChange([...shots, s]);
              onSelect(s.id);
            }}
          >
            ＋ 图像
          </button>
        </span>
      </div>
      <div className="panel-body">
        {shots.length === 0 && <div className="empty-hint">还没有镜头，点右上角添加</div>}
        {shots.map((s, i) => (
          <div
            key={s.id}
            className={`item selectable ${s.id === selectedId ? 'selected' : ''}`}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx !== null && dragIdx !== i) onChange(moveItem(shots, dragIdx, i));
              setDragIdx(null);
            }}
            onClick={() => onSelect(s.id)}
          >
            <div className="item-row">
              <span className="drag-handle" title="拖动排序" onClick={(e) => e.stopPropagation()}>
                ⋮⋮
              </span>
              <span className="item-name">
                {s.id} · {s.label || '（未命名）'}
              </span>
              <span className="item-actions" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="btn btn-ghost btn-small" onClick={() => duplicate(s.id)}>
                  复制
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => {
                    if (window.confirm(`删除镜头「${s.id}」？`)) {
                      onChange(shots.filter((x) => x.id !== s.id));
                    }
                  }}
                >
                  删除
                </button>
              </span>
            </div>
            <div className="item-sub">
              <span className="tag">{s.kind === 'video' ? '视频' : '图像'}</span>{' '}
              <span className="tag">{s.status}</span> <span>{shotSub(s)}</span>
              {(hintCounts?.[s.id] ?? 0) > 0 && (
                <span className="tag tag-hint" title="有校验提示，选中镜头后在预览区查看">
                  ⚠ {hintCounts?.[s.id]}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
