import { useState } from 'react';
import type { Card } from '../../lib/types';
import appOptions from '../appOptions.json';
import { blankCard } from '../project';
import { AppSelect, TextArea, TextInput } from './controls';

interface Props {
  cards: Card[];
  onChange: (cards: Card[]) => void;
}

export default function CardsPanel({ cards, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = cards.find((c) => c.id === editingId) ?? null;

  const updateCard = (id: string, patch: Partial<Card>) => {
    onChange(cards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">档案卡</span>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            const card = blankCard();
            onChange([...cards, card]);
            setEditingId(card.id);
          }}
        >
          ＋ 添加
        </button>
      </div>
      <div className="panel-body">
        {cards.length === 0 && <div className="empty-hint">还没有档案卡，点右上角添加</div>}
        {cards.map((c) => (
          <div key={c.id} className="item">
            <div className="item-row" onClick={() => setEditingId(editingId === c.id ? null : c.id)}>
              <span className="tag">{c.type}</span>
              <span className="item-name">{c.name || '（未命名）'}</span>
              <span className="item-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`删除档案卡「${c.name}」？`)) {
                      onChange(cards.filter((x) => x.id !== c.id));
                      if (editingId === c.id) setEditingId(null);
                    }
                  }}
                >
                  删除
                </button>
              </span>
            </div>
            {editingId === c.id && editing && (
              <div className="item-form">
                <AppSelect
                  label="类型"
                  options={appOptions.cardType}
                  value={editing.type}
                  onChange={(v) => updateCard(c.id, { type: v })}
                />
                <TextInput
                  label="名称"
                  value={editing.name}
                  onChange={(v) => updateCard(c.id, { name: v })}
                />
                <TextArea
                  label="描述"
                  rows={3}
                  value={editing.description}
                  placeholder="写一次，全片引用此卡的镜头自动更新"
                  onChange={(v) => updateCard(c.id, { description: v })}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
