// JSON 导入：结构校验、词表检查、卡片冲突处理。纯函数，无提示词措辞。
import type { Card, DialogueLine, Segment, Shot } from '../lib/types';
import { blankCard, blankDialogue, blankSegment, blankShot, uid } from './project';
import { vocabField, type VocabField, type VocabPath } from './vocab';

export type FieldPath = (string | number)[];

export interface StructIssue {
  path: string;
  message: string;
}

export interface VocabWarning {
  shotId: string;
  /** 该镜头在导入 shots 数组中的下标（用于回写修正） */
  shotIndex: number;
  /** 如“第1段·景别”“音乐”（界面显示用） */
  fieldLabel: string;
  /** 在 shots 数组中的路径，如 ['segments', 0, 'shotSize'] */
  path: FieldPath;
  value: string;
  /** 命中别名时的建议值；未命中为空串（不给建议） */
  suggestion: string;
  /** 该字段的全部合法选项，供用户在下拉框中自选 */
  options: string[];
}

export interface ValidatedImport {
  cards: unknown[];
  shots: unknown[];
  questions: string[];
}

const s = (v: unknown, d: string): string => (typeof v === 'string' ? v : d);

/** 校验粘贴的 JSON，返回数据或结构错误（有错误则 data 为 null）。 */
export function validateImport(text: string): {
  data: ValidatedImport | null;
  issues: StructIssue[];
} {
  const issues: StructIssue[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { data: null, issues: [{ path: '根', message: '不是合法的 JSON，请检查后重新粘贴' }] };
  }
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      data: null,
      issues: [{ path: '根', message: '顶层应为对象，包含 cards / shots / questions' }],
    };
  }
  const p = parsed as Record<string, unknown>;
  const cards = Array.isArray(p.cards) ? p.cards : [];
  const shots = Array.isArray(p.shots) ? p.shots : [];
  const questions = Array.isArray(p.questions)
    ? (p.questions as unknown[]).filter((q): q is string => typeof q === 'string')
    : [];
  if (!Array.isArray(p.shots)) issues.push({ path: 'shots', message: '缺少 shots 数组' });

  const seenCard = new Set<string>();
  const seenShot = new Set<string>();
  cards.forEach((c: unknown, i: number) => {
    const id = (c as Record<string, unknown>)?.id;
    if (typeof id !== 'string' || !id) {
      issues.push({ path: `cards[${i}].id`, message: '档案卡 id 缺失或不是字符串' });
    } else if (seenCard.has(id)) {
      issues.push({ path: `cards[${i}].id`, message: `档案卡 id 重复：${id}` });
    } else {
      seenCard.add(id);
    }
  });
  shots.forEach((sh: unknown, i: number) => {
    const r = sh as Record<string, unknown>;
    if (typeof r?.id !== 'string' || !r.id) {
      issues.push({ path: `shots[${i}].id`, message: '镜头 id 缺失或不是字符串' });
    } else if (seenShot.has(r.id)) {
      issues.push({ path: `shots[${i}].id`, message: `镜头 id 重复：${r.id}` });
    } else {
      seenShot.add(r.id);
    }
    if (r && r.kind !== 'video' && r.kind !== 'image') {
      issues.push({ path: `shots[${i}].kind`, message: 'kind 须为 video 或 image' });
    }
  });

  if (issues.length > 0) return { data: null, issues };
  return { data: { cards, shots, questions }, issues: [] };
}

/**
 * 查别名表给出建议：只有命中别名（忽略首尾空格与英文大小写）才返回合法选项；
 * 未命中返回空串，界面只标红并让用户从下拉框自选，不做猜测。
 */
export function aliasSuggestion(value: string, field: VocabField): string {
  const aliases = field.aliases ?? {};
  const key = value.trim();
  const hit = aliases[key] ?? Object.entries(aliases).find(
    ([k]) => k.toLowerCase() === key.toLowerCase(),
  )?.[1];
  return hit !== undefined && field.options.includes(hit) ? hit : '';
}

interface VocabSlot {
  vocabPath: VocabPath;
  label: string;
}

function checkSlot(
  value: unknown,
  slot: VocabSlot,
  warnings: VocabWarning[],
  warn: Omit<VocabWarning, 'value' | 'suggestion' | 'options'>,
): void {
  if (typeof value !== 'string' || value === '') return; // 空值不标红
  const field = vocabField(slot.vocabPath);
  if (field.allowCustom) return; // 可自填字段不校验
  if (field.options.includes(value)) return;
  warnings.push({
    ...warn,
    value,
    suggestion: aliasSuggestion(value, field),
    options: field.options.filter((o) => o !== ''),
  });
}

/** 检查导入镜头中受控词表字段的取值；返回词表外取值告警。 */
export function checkVocabValues(shots: unknown[]): VocabWarning[] {
  const warnings: VocabWarning[] = [];
  shots.forEach((raw: unknown, i: number) => {
    const sh = raw as Record<string, unknown>;
    if (!sh || typeof sh !== 'object') return;
    const shotId = typeof sh.id === 'string' ? sh.id : `shots[${i}]`;
    const base = { shotIndex: i, shotId } as Omit<
      VocabWarning,
      'value' | 'suggestion' | 'options' | 'fieldLabel' | 'path'
    >;
    if (sh.kind === 'video') {
      const segments = Array.isArray(sh.segments) ? sh.segments : [];
      segments.forEach((seg: unknown, j: number) => {
        const g = seg as Record<string, unknown>;
        if (!g || typeof g !== 'object') return;
        const tag = `第${j + 1}段`;
        const slots: [string, VocabSlot][] = [
          ['shotSize', { vocabPath: 'shotSize', label: `${tag}·景别` }],
          ['angle', { vocabPath: 'angle', label: `${tag}·角度` }],
        ];
        for (const [key, slot] of slots) {
          checkSlot(g[key], slot, warnings, { ...base, fieldLabel: slot.label, path: ['segments', j, key] });
        }
        const move = (g.move ?? {}) as Record<string, unknown>;
        const moveSlots: [string, VocabSlot][] = [
          ['type', { vocabPath: 'move.type', label: `${tag}·运镜类型` }],
          ['amount', { vocabPath: 'move.amount', label: `${tag}·幅度` }],
          ['speed', { vocabPath: 'move.speed', label: `${tag}·速度` }],
          ['direction', { vocabPath: 'move.direction', label: `${tag}·方向` }],
        ];
        for (const [key, slot] of moveSlots) {
          checkSlot(move[key], slot, warnings, {
            ...base,
            fieldLabel: slot.label,
            path: ['segments', j, 'move', key],
          });
        }
      });
      checkSlot(sh.music, { vocabPath: 'music', label: '音乐' }, warnings, {
        ...base,
        fieldLabel: '音乐',
        path: ['music'],
      });
    } else if (sh.kind === 'image') {
      const slots: [string, VocabSlot][] = [
        ['shotSize', { vocabPath: 'shotSize', label: '景别' }],
        ['composition', { vocabPath: 'composition', label: '构图' }],
        ['angle', { vocabPath: 'angle', label: '角度' }],
        ['light', { vocabPath: 'light', label: '光线' }],
      ];
      for (const [key, slot] of slots) {
        checkSlot(sh[key], slot, warnings, { ...base, fieldLabel: slot.label, path: [key] });
      }
    }
  });
  return warnings;
}

/** 在对象上按路径取值 / 赋值（路径元素为 string | number）。 */
export function getPath(obj: unknown, path: FieldPath): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[k];
  }
  return cur;
}

export function setPath(obj: Record<string, unknown>, path: FieldPath, value: unknown): void {
  let cur: Record<string | number, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    cur = cur[path[i]] as Record<string | number, unknown>;
  }
  cur[path[path.length - 1]] = value;
}

/** base 取首个未被占用的 id。 */
export function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  let n = 1;
  while (taken.has(id)) {
    n += 1;
    id = `${base}_导入${n}`;
  }
  return id;
}

function normalizeSegment(raw: unknown): Segment {
  const seg = blankSegment();
  const g = (raw ?? {}) as Record<string, unknown>;
  return {
    start: typeof g.start === 'number' ? g.start : seg.start,
    end: typeof g.end === 'number' ? g.end : seg.end,
    shotSize: s(g.shotSize, ''),
    angle: s(g.angle, ''),
    move: {
      type: s((g.move as Record<string, unknown>)?.type, ''),
      amount: s((g.move as Record<string, unknown>)?.amount, ''),
      speed: s((g.move as Record<string, unknown>)?.speed, ''),
      direction: s((g.move as Record<string, unknown>)?.direction, ''),
    },
    action: s(g.action, ''),
  };
}

function normalizeDialogue(raw: unknown): DialogueLine {
  const d = blankDialogue();
  const g = (raw ?? {}) as Record<string, unknown>;
  return {
    character: s(g.character, ''),
    emotion: s(g.emotion, ''),
    line: s(g.line, ''),
    segment: typeof g.segment === 'number' ? g.segment : d.segment,
  };
}

/** 把导入的镜头 raw 对象规整为完整 Shot（缺失字段补默认）。 */
export function normalizeShot(raw: unknown): Shot {
  const g = (raw ?? {}) as Record<string, unknown>;
  const kind = g.kind === 'image' ? 'image' : 'video';
  const base = blankShot(kind);
  const shot = { ...base } as Record<string, unknown>;
  shot.id = typeof g.id === 'string' && g.id ? g.id : uid('shot');
  shot.label = s(g.label, '');
  shot.purpose = s(g.purpose, '');
  shot.subjectCard = s(g.subjectCard, '');
  shot.subject = s(g.subject, '');
  shot.environment = s(g.environment, '');
  shot.styleCard = s(g.styleCard, '');
  shot.keep = Array.isArray(g.keep)
    ? (g.keep as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  shot.params =
    g.params != null && typeof g.params === 'object' && !Array.isArray(g.params) ? g.params : {};
  if (kind === 'video') {
    shot.duration = typeof g.duration === 'number' ? g.duration : 5;
    shot.segments = Array.isArray(g.segments) ? (g.segments as unknown[]).map(normalizeSegment) : [];
    shot.dialogue = Array.isArray(g.dialogue) ? (g.dialogue as unknown[]).map(normalizeDialogue) : [];
    shot.sfx = s(g.sfx, '');
    shot.music = s(g.music, '');
    shot.subtitles = g.subtitles === true;
  } else {
    shot.action = s(g.action, '');
    shot.shotSize = s(g.shotSize, '');
    shot.composition = s(g.composition, '');
    shot.angle = s(g.angle, '');
    shot.light = s(g.light, '');
    shot.color = s(g.color, '');
    shot.material = s(g.material, '');
    shot.style = s(g.style, '');
    const t = g.text as Record<string, unknown> | undefined;
    shot.text =
      t != null && typeof t === 'object'
        ? { content: s(t.content, ''), position: s(t.position, ''), style: s(t.style, '') }
        : null;
  }
  return shot as unknown as Shot;
}

/** 把导入的档案卡 raw 对象规整为完整 Card。 */
export function normalizeCard(raw: unknown): Card {
  const base = blankCard();
  const g = (raw ?? {}) as Record<string, unknown>;
  return {
    ...base,
    id: typeof g.id === 'string' && g.id ? g.id : uid('card'),
    type: s(g.type, base.type),
    name: s(g.name, ''),
    description: s(g.description, ''),
  };
}

export type CardResolution = 'keep' | 'rename';

/**
 * 处理档案卡 id 冲突：'keep' 保留现有卡（导入卡丢弃，引用指向现有卡）；
 * 'rename' 给导入卡换新 id（引用同步改写）。
 */
export function resolveCardConflicts(
  existing: Card[],
  imported: Card[],
  decisions: Record<string, CardResolution>,
): { cardsToAdd: Card[]; idMap: Record<string, string> } {
  const taken = new Set(existing.map((c) => c.id));
  const cardsToAdd: Card[] = [];
  const idMap: Record<string, string> = {};
  for (const card of imported) {
    const conflict = existing.some((c) => c.id === card.id);
    if (!conflict) {
      taken.add(card.id);
      cardsToAdd.push(card);
      idMap[card.id] = card.id;
      continue;
    }
    if (decisions[card.id] === 'rename') {
      const newId = uniqueId(card.id, taken);
      taken.add(newId);
      cardsToAdd.push({ ...card, id: newId });
      idMap[card.id] = newId;
    } else {
      // keep：不覆盖已有卡，引用保持原 id（指向现有卡）
      idMap[card.id] = card.id;
    }
  }
  return { cardsToAdd, idMap };
}
