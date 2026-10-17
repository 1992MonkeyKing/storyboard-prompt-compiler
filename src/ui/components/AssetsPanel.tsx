import { useState } from 'react';
import type { Asset } from '../../lib/types';
import appOptions from '../appOptions.json';
import { assetLabel, assetNumbers } from '../labels';
import { blankAsset, moveItem } from '../project';
import { AppSelect, TextArea, TextInput } from './controls';

interface Props {
  assets: Asset[];
  platformId: string;
  onChange: (assets: Asset[]) => void;
}

export default function AssetsPanel({ assets, platformId, onChange }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Asset>(() => blankAsset());
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const numbers = assetNumbers(assets);

  const labelOf = (a: Asset) => assetLabel(platformId, a.kind, numbers.get(a.id) ?? 0);

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">素材</span>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            setDraft(blankAsset());
            setShowForm(!showForm);
          }}
        >
          ＋ 登记
        </button>
      </div>
      <div className="panel-body">
        {showForm && (
          <div className="item-form">
            <AppSelect
              label="类型"
              options={appOptions.assetKind}
              value={draft.kind}
              onChange={(v) => setDraft({ ...draft, kind: v as Asset['kind'] })}
            />
            <TextInput
              label="文件名"
              value={draft.file}
              placeholder="product_front.png"
              onChange={(v) => setDraft({ ...draft, file: v })}
            />
            <TextInput
              label="职责"
              value={draft.role}
              placeholder="提供产品外形、颜色和字样"
              onChange={(v) => setDraft({ ...draft, role: v })}
            />
            <TextInput
              label="保留"
              value={draft.keep}
              onChange={(v) => setDraft({ ...draft, keep: v })}
            />
            <TextInput
              label="不取"
              value={draft.exclude}
              onChange={(v) => setDraft({ ...draft, exclude: v })}
            />
            <button
              type="button"
              className="btn"
              onClick={() => {
                onChange([...assets, draft]);
                setDraft(blankAsset());
                setShowForm(false);
              }}
            >
              确认添加
            </button>
          </div>
        )}
        {assets.length === 0 && !showForm && (
          <div className="empty-hint">还没有素材，点右上角登记（编号按类型自动生成）</div>
        )}
        {assets.map((a, i) => (
          <div
            key={a.id}
            className="item"
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx !== null && dragIdx !== i) onChange(moveItem(assets, dragIdx, i));
              setDragIdx(null);
            }}
          >
            <div className="item-row">
              <span className="drag-handle" title="拖动排序">
                ⋮⋮
              </span>
              <span className="tag tag-asset">{labelOf(a)}</span>
              <span className="item-name">{a.file || '（未填文件名）'}</span>
              <span className="item-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => {
                    if (window.confirm(`删除素材「${a.file || a.id}」？`)) {
                      onChange(assets.filter((x) => x.id !== a.id));
                    }
                  }}
                >
                  删除
                </button>
              </span>
            </div>
            {a.role && <div className="item-sub">{a.role}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
