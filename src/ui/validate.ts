// 阶段 4：校验提示（SPEC 第五部分）。纯函数，只提示，不阻止编译。
// 提示文案属于界面文案，不是提示词措辞；编译输出只用于检查重复短语。
import { compile, listPlatforms } from '../lib/compile';
import type { Project, Shot, VideoShot } from '../lib/types';
import vocabJson from '../../vocab/zh.json';

export type HintLevel = 'warn' | 'info';

export interface Hint {
  level: HintLevel;
  message: string;
}

/** 单个分段建议的最长时长（秒），超过即提示拆分。 */
export const MAX_SEGMENT_SECONDS = 5;

/** 重复短语检查的最短长度（字符），避免“平视”这类短词误报。 */
const MIN_REPEAT_LEN = 4;

function checkReferences(project: Project, shot: Shot, hints: Hint[]): void {
  const cardIds = new Set(project.cards.map((c) => c.id));
  if (shot.subjectCard && !cardIds.has(shot.subjectCard)) {
    hints.push({ level: 'warn', message: `主体档案卡「${shot.subjectCard}」不存在，主体描述会缺失` });
  }
  if (shot.styleCard && !cardIds.has(shot.styleCard)) {
    hints.push({ level: 'warn', message: `风格档案卡「${shot.styleCard}」不存在，风格描述会缺失` });
  }
  const assetIds = new Set(project.assets.map((a) => a.id));
  for (const id of shot.assetIds) {
    if (!assetIds.has(id)) {
      hints.push({ level: 'warn', message: `引用的素材「${id}」不存在` });
    }
  }
}

function checkRequired(project: Project, shot: Shot, hints: Hint[]): void {
  const cardDesc = project.cards.find((c) => c.id === shot.subjectCard)?.description ?? '';
  if (!cardDesc.trim() && !shot.subject.trim()) {
    hints.push({ level: 'warn', message: '主体为空：请选择主体档案卡或填写主体补充' });
  }
  const ratio = shot.params?.ratio;
  if (typeof ratio !== 'string' || !ratio.trim()) {
    hints.push({ level: 'info', message: '未设置画幅比例（参数不进提示词，但生成时要在平台里选）' });
  }
}

/** 动作里提到“字幕/文字/字样”等，但该分段没有填写画面文字内容。 */
const TEXT_MENTION = /字幕|文字|字样|标语|书法字|标题/;

function checkTextMentions(shot: VideoShot, hints: Hint[]): void {
  shot.segments.forEach((seg, i) => {
    if (TEXT_MENTION.test(seg.action ?? '') && !(seg.text?.content ?? '').trim()) {
      hints.push({
        level: 'warn',
        message: `第${i + 1}段动作里提到了文字/字幕，但没有填写“画面文字”内容，模型可能乱写字或不出字`,
      });
    }
  });
}

function checkTimeline(shot: VideoShot, hints: Hint[]): void {
  const segs = shot.segments;
  if (segs.length === 0) {
    hints.push({ level: 'warn', message: '至少需要一个分段' });
    return;
  }
  segs.forEach((seg, i) => {
    const label = `第${i + 1}段`;
    if (!seg.action.trim()) {
      hints.push({ level: 'warn', message: `${label}缺少动作` });
    }
    if (seg.end <= seg.start) {
      hints.push({ level: 'warn', message: `${label}结束时间（${seg.end}秒）不晚于开始时间（${seg.start}秒）` });
      return;
    }
    const len = seg.end - seg.start;
    if (len > MAX_SEGMENT_SECONDS) {
      hints.push({
        level: 'info',
        message: `${label}长 ${len} 秒，超过 ${MAX_SEGMENT_SECONDS} 秒，建议拆成两段`,
      });
    }
  });
  if (segs[0].start !== 0) {
    hints.push({ level: 'warn', message: `第1段应从 0 秒开始（当前为 ${segs[0].start} 秒）` });
  }
  for (let i = 1; i < segs.length; i++) {
    const prev = segs[i - 1];
    const cur = segs[i];
    if (cur.start > prev.end) {
      hints.push({
        level: 'warn',
        message: `第${i}段与第${i + 1}段之间有空档（${prev.end}–${cur.start}秒），时间轴应首尾相接`,
      });
    } else if (cur.start < prev.end) {
      hints.push({
        level: 'warn',
        message: `第${i}段与第${i + 1}段时间重叠（${cur.start}–${prev.end}秒）`,
      });
    }
  }
  const lastEnd = segs[segs.length - 1].end;
  if (lastEnd !== shot.duration) {
    hints.push({
      level: 'warn',
      message: `分段总长 ${lastEnd} 秒，与镜头时长 ${shot.duration} 秒不一致`,
    });
  }
  const total = segs.length;
  shot.dialogue.forEach((d, i) => {
    if (d.segment != null && (d.segment < 1 || d.segment > total)) {
      hints.push({
        level: 'info',
        message: `第${i + 1}条台词指向第${d.segment}段，但只有 ${total} 段，已放进最后一段`,
      });
    }
  });
}

/** 词表里的标准取值（景别、景深等）在不同分段重复出现是正常的，不算重复内容。 */
function collectOptions(node: unknown, out: Set<string>): Set<string> {
  if (node && typeof node === 'object') {
    const n = node as Record<string, unknown>;
    if (Array.isArray(n.options)) for (const o of n.options) if (typeof o === 'string') out.add(o);
    for (const [k, v] of Object.entries(n)) if (k !== 'options' && k !== 'aliases') collectOptions(v, out);
  }
  return out;
}
const VOCAB_VALUES = collectOptions(vocabJson, new Set<string>());

const TIMESTAMP = /^[\d.]+\s*[-–~至]\s*[\d.]+\s*秒$/;

function countOccurrences(text: string, p: string): number {
  let n = 0;
  for (let i = text.indexOf(p); i !== -1; i = text.indexOf(p, i + p.length)) n++;
  return n;
}

/**
 * 把编译结果切成短语（按句号、逗号、分号、冒号、换行），
 * 找出在全文中出现两次及以上的短语（包括嵌在别的短语里的情况）。
 * 被更长的重复短语包含的短语不再单独报告。
 */
export function repeatedPhrases(text: string): string[] {
  const phrases = new Set<string>();
  for (const raw of text.split(/[。，；！？：:\n]/)) {
    const p = raw.trim();
    // 纯时间戳（如“0-3秒”）是时间轴结构的一部分，不算重复内容
    if (p.length >= MIN_REPEAT_LEN && !TIMESTAMP.test(p) && !VOCAB_VALUES.has(p)) phrases.add(p);
  }
  const repeated = [...phrases].filter((p) => countOccurrences(text, p) > 1);
  return repeated.filter((p) => !repeated.some((q) => q !== p && q.includes(p)));
}

function checkRepeats(project: Project, shot: Shot, hints: Hint[]): void {
  const tpl = listPlatforms().find((t) => t.kind === shot.kind);
  if (!tpl) return;
  // 用传入的镜头替换项目里的同 id 镜头再编译，保证检查的是正在校验的这一版
  const scoped: Project = {
    ...project,
    shots: project.shots.some((s) => s.id === shot.id)
      ? project.shots.map((s) => (s.id === shot.id ? shot : s))
      : [...project.shots, shot],
  };
  let out: string;
  try {
    out = compile(scoped, shot.id, tpl.id);
  } catch {
    return;
  }
  for (const p of repeatedPhrases(out)) {
    hints.push({ level: 'info', message: `提示词中重复出现「${p}」，检查是否在两个字段里写了同样的内容` });
  }
}

/** 某个镜头的全部校验提示。 */
export function validateShot(project: Project, shot: Shot): Hint[] {
  const hints: Hint[] = [];
  checkReferences(project, shot, hints);
  checkRequired(project, shot, hints);
  if (shot.kind === 'video') {
    checkTimeline(shot as VideoShot, hints);
    checkTextMentions(shot as VideoShot, hints);
  }
  checkRepeats(project, shot, hints);
  return hints;
}

/** 全部镜头的提示数量（镜头列表角标用）。 */
export function hintCounts(project: Project): Record<string, number> {
  const out: Record<string, number> = {};
  for (const shot of project.shots) out[shot.id] = validateShot(project, shot).length;
  return out;
}
