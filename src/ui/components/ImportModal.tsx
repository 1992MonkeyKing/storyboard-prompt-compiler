// JSON 导入弹窗：粘贴 → 结构校验 → 问题列表 / 词表外标红 / 卡片冲突处理 → 确认导入。
import { useState } from 'react';
import type { Card, Project, Shot } from '../../lib/types';
import { buildBreakdownPrompt } from '../breakdown';
import {
  checkVocabValues,
  normalizeCard,
  normalizeShot,
  resolveCardConflicts,
  setPath,
  uniqueId,
  validateImport,
  type CardResolution,
  type StructIssue,
  type VocabWarning,
} from '../importer';
import { CopyButton } from './controls';

interface CardConflictView {
  imported: Card;
  existing: Card;
}

interface ReviewState {
  cards: Card[];
  rawShots: Record<string, unknown>[];
  questions: string[];
  issues: StructIssue[];
  warnings: VocabWarning[];
  adopted: boolean[];
  conflicts: CardConflictView[];
  resolutions: Record<string, CardResolution | undefined>;
}

interface Props {
  project: Project;
  onClose: () => void;
  onImport: (cards: Card[], shots: Shot[]) => void;
}

const emptyReview = (issues: StructIssue[]): ReviewState => ({
  cards: [],
  rawShots: [],
  questions: [],
  issues,
  warnings: [],
  adopted: [],
  conflicts: [],
  resolutions: {},
});

export default function ImportModal({ project, onClose, onImport }: Props) {
  const [text, setText] = useState('');
  const [review, setReview] = useState<ReviewState | null>(null);

  const doValidate = () => {
    const { data, issues } = validateImport(text);
    if (!data) {
      setReview(emptyReview(issues));
      return;
    }
    const cards = data.cards.map(normalizeCard);
    const rawShots = data.shots as Record<string, unknown>[];
    const warnings = checkVocabValues(data.shots);
    const existingById = new Map(project.cards.map((c) => [c.id, c]));
    const conflicts: CardConflictView[] = [];
    for (const card of cards) {
      const existing = existingById.get(card.id);
      if (existing) conflicts.push({ imported: card, existing });
    }
    setReview({
      cards,
      rawShots,
      questions: data.questions,
      issues: [],
      warnings,
      adopted: warnings.map(() => false),
      conflicts,
      resolutions: {},
    });
  };

  const adoptWarning = (idx: number) => {
    setReview((prev) => {
      if (!prev || prev.adopted[idx]) return prev;
      const rawShots = JSON.parse(JSON.stringify(prev.rawShots)) as Record<string, unknown>[];
      const w = prev.warnings[idx];
      setPath(rawShots[w.shotIndex], w.path, w.suggestion);
      const adopted = prev.adopted.slice();
      adopted[idx] = true;
      return { ...prev, rawShots, adopted };
    });
  };

  const setResolution = (cardId: string, r: CardResolution) => {
    setReview((prev) =>
      prev ? { ...prev, resolutions: { ...prev.resolutions, [cardId]: r } } : prev,
    );
  };

  const canConfirm =
    review !== null &&
    review.issues.length === 0 &&
    review.conflicts.every((c) => review.resolutions[c.imported.id] !== undefined);

  const doImport = () => {
    if (!review || !canConfirm) return;
    const { cardsToAdd, idMap } = resolveCardConflicts(
      project.cards,
      review.cards,
      review.resolutions as Record<string, CardResolution>,
    );
    const takenShotIds = new Set(project.shots.map((s) => s.id));
    const shots: Shot[] = review.rawShots.map((raw) => {
      const s = normalizeShot(raw);
      if (s.subjectCard && idMap[s.subjectCard]) s.subjectCard = idMap[s.subjectCard];
      if (s.styleCard && idMap[s.styleCard]) s.styleCard = idMap[s.styleCard];
      if (takenShotIds.has(s.id)) s.id = uniqueId(s.id, takenShotIds);
      takenShotIds.add(s.id);
      s.status = '草稿';
      return s;
    });
    onImport(cardsToAdd, shots);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="panel-title">导入拆解 JSON</span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="modal-body">
          {review === null ? (
            <>
              <p className="modal-hint">
                把 LLM 拆解得到的 JSON 粘贴到下面。先用
                <CopyButton label="复制拆解提示词" getText={buildBreakdownPrompt} />
                去外部大模型生成 JSON。
              </p>
              <textarea
                className="import-textarea"
                value={text}
                rows={12}
                placeholder='粘贴形如 {"cards":[…],"shots":[…],"questions":[…]} 的 JSON'
                onChange={(e) => setText(e.target.value)}
              />
              <div className="modal-foot">
                <button type="button" className="btn btn-primary" onClick={doValidate} disabled={!text.trim()}>
                  校验并预览
                </button>
              </div>
            </>
          ) : (
            <>
              {review.issues.length > 0 && (
                <section className="review-section">
                  <h4>结构错误（须修正后才能导入）</h4>
                  <ul className="issue-list">
                    {review.issues.map((it, i) => (
                      <li key={i}>
                        <code>{it.path}</code>：{it.message}
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="btn" onClick={() => setReview(null)}>
                    返回修改
                  </button>
                </section>
              )}

              {review.issues.length === 0 && (
                <>
                  {review.questions.length > 0 && (
                    <section className="review-section questions-box">
                      <h4>LLM 留下的问题（请补齐这些信息）</h4>
                      <ol>
                        {review.questions.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ol>
                    </section>
                  )}

                  {review.warnings.length > 0 && (
                    <section className="review-section">
                      <h4>词表外取值（{review.warnings.length}）</h4>
                      <ul className="warn-list">
                        {review.warnings.map((w, i) => (
                          <li key={i}>
                            <span className="warn-shot">{w.shotId}</span>
                            <span className="warn-field">{w.fieldLabel}</span>：
                            <span className="vocab-bad">{w.value}</span>
                            <span className="warn-suggest">→ 建议：{w.suggestion}</span>
                            {review.adopted[i] ? (
                              <span className="warn-done">已采用 ✓</span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-small"
                                onClick={() => adoptWarning(i)}
                              >
                                采用建议
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {review.conflicts.length > 0 && (
                    <section className="review-section">
                      <h4>档案卡 id 冲突（{review.conflicts.length}）</h4>
                      {review.conflicts.map((c) => {
                        const r = review.resolutions[c.imported.id];
                        return (
                          <div key={c.imported.id} className="conflict-row">
                            <div className="conflict-info">
                              <code>{c.imported.id}</code>
                              <span>现有：{c.existing.name}（{c.existing.type}）</span>
                              <span>导入：{c.imported.name}（{c.imported.type}）</span>
                            </div>
                            <div className="conflict-actions">
                              <button
                                type="button"
                                className={`btn btn-small${r === 'keep' ? ' btn-active' : ''}`}
                                onClick={() => setResolution(c.imported.id, 'keep')}
                              >
                                保留现有
                              </button>
                              <button
                                type="button"
                                className={`btn btn-small${r === 'rename' ? ' btn-active' : ''}`}
                                onClick={() => setResolution(c.imported.id, 'rename')}
                              >
                                重命名导入
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </section>
                  )}

                  {review.warnings.length === 0 && review.conflicts.length === 0 && (
                    <p className="modal-hint">校验通过，无词表外取值，无卡片冲突。</p>
                  )}

                  <p className="modal-hint">
                    将导入 {review.cards.length} 张档案卡、
                    {review.rawShots.length} 个镜头（状态一律为“草稿”）。
                  </p>
                  <div className="modal-foot">
                    <button type="button" className="btn" onClick={() => setReview(null)}>
                      返回修改
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!canConfirm}
                      onClick={doImport}
                      title={
                        canConfirm ? '' : '请先处理全部档案卡冲突'
                      }
                    >
                      确认导入
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
