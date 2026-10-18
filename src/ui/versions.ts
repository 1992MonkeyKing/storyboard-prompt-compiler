// 阶段 4：定稿快照与版本对比。纯函数（时间由调用方传入）。
import { compile, listPlatforms } from '../lib/compile';
import type { Project, Shot, ShotVersion } from '../lib/types';
import { splitSentences } from './diff';

const FINAL_STATUS: Shot['status'] = '定稿';

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

/** 按当前项目，把镜头编译到所有同类型平台。 */
export function compileForKind(project: Project, shot: Shot): Record<string, string> {
  const prompts: Record<string, string> = {};
  for (const tpl of listPlatforms()) {
    if (tpl.kind !== shot.kind) continue;
    try {
      prompts[tpl.id] = compile(project, shot.id, tpl.id);
    } catch {
      prompts[tpl.id] = '';
    }
  }
  return prompts;
}

/** 为镜头生成一个快照（含它引用的档案卡与素材）。 */
export function makeSnapshot(project: Project, shot: Shot, n: number, savedAt: string): ShotVersion {
  const cardIds = new Set([shot.subjectCard, shot.styleCard].filter(Boolean));
  const assetIds = new Set(shot.assetIds);
  return {
    n,
    savedAt,
    shot: clone(shot),
    cards: clone(project.cards.filter((c) => cardIds.has(c.id))),
    assets: clone(project.assets.filter((a) => assetIds.has(a.id))),
    prompts: compileForKind(project, shot),
  };
}

export function versionsOf(project: Project, shotId: string): ShotVersion[] {
  return project.versions?.[shotId] ?? [];
}

/**
 * 应用一次镜头编辑。镜头状态从非“定稿”变为“定稿”时，自动保存一个版本快照；
 * 一直处于“定稿”的后续编辑不重复保存。
 */
export function applyShotEdit(project: Project, next: Shot, savedAt: string): Project {
  const prev = project.shots.find((s) => s.id === next.id);
  const shots = project.shots.map((s) => (s.id === next.id ? next : s));
  const updated: Project = { ...project, shots };
  const becameFinal = next.status === FINAL_STATUS && prev?.status !== FINAL_STATUS;
  if (!becameFinal) return updated;
  const list = versionsOf(project, next.id);
  const n = (list[list.length - 1]?.n ?? 0) + 1;
  const snap = makeSnapshot(updated, next, n, savedAt);
  return { ...updated, versions: { ...(project.versions ?? {}), [next.id]: [...list, snap] } };
}

/** 镜头被删除时同时清掉它的版本。 */
export function dropVersionsOfMissingShots(project: Project): Project {
  if (!project.versions) return project;
  const ids = new Set(project.shots.map((s) => s.id));
  const kept = Object.fromEntries(Object.entries(project.versions).filter(([id]) => ids.has(id)));
  return Object.keys(kept).length === Object.keys(project.versions).length
    ? project
    : { ...project, versions: kept };
}

export type DiffOp = { type: 'same' | 'added' | 'removed'; text: string };

/**
 * 逐句对比两段提示词（LCS）。输出按新文本顺序排列，被删除的句子插在原位置。
 */
export function diffSentences(oldText: string, newText: string): DiffOp[] {
  const a = splitSentences(oldText).tokens.map((t) => t.text);
  const b = splitSentences(newText).tokens.map((t) => t.text);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'same', text: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'removed', text: a[i] });
      i++;
    } else {
      ops.push({ type: 'added', text: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: 'removed', text: a[i++] });
  while (j < m) ops.push({ type: 'added', text: b[j++] });
  return ops;
}
