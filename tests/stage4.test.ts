// 阶段 4 单元测试：校验提示、定稿快照、逐句版本对比。
import { describe, expect, it } from 'vitest';
import { compile } from '../src/lib/compile';
import type { Project, Shot, VideoShot } from '../src/lib/types';
import { hintCounts, repeatedPhrases, validateShot } from '../src/ui/validate';
import {
  applyShotEdit,
  diffSentences,
  dropVersionsOfMissingShots,
  versionsOf,
} from '../src/ui/versions';
import { parseProjectJson, projectJsonText } from '../src/ui/export';
import exampleJson from '../examples/xtech-tvc.json';

const fresh = (): Project => JSON.parse(JSON.stringify(exampleJson)) as Project;
const video = (p: Project): VideoShot => p.shots.find((s) => s.id === 'S01') as VideoShot;
const msgs = (p: Project, s: Shot) => validateShot(p, s).map((h) => h.message);

describe('validateShot', () => {
  it('示例项目 S01 / S02 没有提示', () => {
    const p = fresh();
    expect(validateShot(p, p.shots[0])).toEqual([]);
    expect(validateShot(p, p.shots[1])).toEqual([]);
    expect(hintCounts(p)).toEqual({ S01: 0, S02: 0 });
  });

  it('档案卡 / 素材引用缺失', () => {
    const p = fresh();
    const s = { ...video(p), subjectCard: 'ghost', styleCard: 'nope', assetIds: ['a1', 'zz'] };
    const m = msgs(p, s);
    expect(m.some((x) => x.includes('ghost'))).toBe(true);
    expect(m.some((x) => x.includes('nope'))).toBe(true);
    expect(m.some((x) => x.includes('zz'))).toBe(true);
    expect(m.some((x) => x.includes('「a1」'))).toBe(false);
  });

  it('主体为空', () => {
    const p = fresh();
    const s = { ...video(p), subjectCard: '', subject: '  ' };
    expect(msgs(p, s).some((x) => x.startsWith('主体为空'))).toBe(true);
  });

  it('没有分段 / 分段缺动作', () => {
    const p = fresh();
    expect(msgs(p, { ...video(p), segments: [] })).toContain('至少需要一个分段');
    const v = video(p);
    const segs = v.segments.map((g, i) => (i === 1 ? { ...g, action: '' } : g));
    expect(msgs(p, { ...v, segments: segs })).toContain('第2段缺少动作');
  });

  it('时间轴：空档、重叠、起点、总长、超 5 秒、倒序', () => {
    const p = fresh();
    const v = video(p);
    const [a, b] = v.segments;
    const gap = msgs(p, { ...v, segments: [a, { ...b, start: 3 }] });
    expect(gap.some((x) => x.includes('空档'))).toBe(true);
    const overlap = msgs(p, { ...v, segments: [a, { ...b, start: 1 }] });
    expect(overlap.some((x) => x.includes('重叠'))).toBe(true);
    const late = msgs(p, { ...v, segments: [{ ...a, start: 1 }, b] });
    expect(late.some((x) => x.includes('应从 0 秒开始'))).toBe(true);
    const short = msgs(p, { ...v, duration: 8 });
    expect(short.some((x) => x.includes('与镜头时长 8 秒不一致'))).toBe(true);
    const long = validateShot(p, { ...v, duration: 8, segments: [a, { ...b, end: 8 }] });
    expect(long).toEqual([{ level: 'info', message: '第2段长 6 秒，超过 5 秒，建议拆成两段' }]);
    const back = msgs(p, { ...v, segments: [a, { ...b, end: 2 }] });
    expect(back.some((x) => x.includes('不晚于开始时间'))).toBe(true);
  });

  it('台词指向不存在的分段', () => {
    const p = fresh();
    const s = { ...video(p), dialogue: [{ character: '旁白', emotion: '', line: '你好', segment: 9 }] };
    expect(msgs(p, s).some((x) => x.includes('指向第9段'))).toBe(true);
  });

  it('重复短语', () => {
    expect(repeatedPhrases('黑色耳机特写，阳光明媚。黑色耳机特写；平视')).toEqual(['黑色耳机特写']);
    expect(repeatedPhrases('平视，平视')).toEqual([]);
    const p = fresh();
    const v = video(p);
    const dup = p.cards.find((c) => c.id === v.subjectCard)!.description.split(/[。，；]/)[0];
    const s = { ...v, subject: dup };
    expect(msgs(p, s).some((x) => x.includes('重复出现'))).toBe(true);
  });

  it('校验不改变编译结果（只提示不阻止）', () => {
    const p = fresh();
    const before = compile(p, 'S01', 'seedance-2.5');
    validateShot(p, { ...video(p), segments: [] });
    expect(compile(p, 'S01', 'seedance-2.5')).toBe(before);
  });
});

describe('定稿快照', () => {
  const T1 = '2026-10-18T01:00:00.000Z';
  const T2 = '2026-10-18T02:00:00.000Z';

  it('非定稿编辑不保存版本', () => {
    const p = applyShotEdit(fresh(), { ...video(fresh()), label: '改名' }, T1);
    expect(versionsOf(p, 'S01')).toEqual([]);
    expect(p.shots[0].label).toBe('改名');
  });

  it('变为定稿时保存，持续定稿不重复保存，再次定稿版本号递增', () => {
    let p = fresh();
    p = applyShotEdit(p, { ...video(p), status: '定稿' }, T1);
    expect(versionsOf(p, 'S01').map((v) => v.n)).toEqual([1]);
    const v1 = versionsOf(p, 'S01')[0];
    expect(v1.savedAt).toBe(T1);
    expect(v1.prompts['seedance-2.5']).toBe(compile(p, 'S01', 'seedance-2.5'));
    expect(v1.cards.map((c) => c.id).sort()).toEqual(['product', 'style']);
    expect(v1.assets.map((a) => a.id)).toEqual(['a1']);

    p = applyShotEdit(p, { ...video(p), subject: '一位年轻女性' }, T2);
    expect(versionsOf(p, 'S01')).toHaveLength(1);

    p = applyShotEdit(p, { ...video(p), status: '待审' }, T2);
    p = applyShotEdit(p, { ...video(p), status: '定稿' }, T2);
    const vs = versionsOf(p, 'S01');
    expect(vs.map((v) => v.n)).toEqual([1, 2]);
    expect(vs[1].prompts['seedance-2.5']).toContain('一位年轻女性');
    expect(vs[0].prompts['seedance-2.5']).not.toContain('一位年轻女性');
  });

  it('快照是深拷贝：之后修改档案卡不影响旧版本', () => {
    let p = fresh();
    p = applyShotEdit(p, { ...video(p), status: '定稿' }, T1);
    const old = versionsOf(p, 'S01')[0].prompts['seedance-2.5'];
    p.cards[0].description = '完全不同的描述';
    expect(versionsOf(p, 'S01')[0].prompts['seedance-2.5']).toBe(old);
    expect(versionsOf(p, 'S01')[0].cards[0].description).not.toBe('完全不同的描述');
  });

  it('版本随项目 JSON 导出 / 导入保留', () => {
    let p = fresh();
    p = applyShotEdit(p, { ...video(p), status: '定稿' }, T1);
    const back = parseProjectJson(projectJsonText(p));
    expect(back?.versions).toEqual(p.versions);
  });

  it('删除镜头时清掉它的版本', () => {
    let p = fresh();
    p = applyShotEdit(p, { ...video(p), status: '定稿' }, T1);
    const kept = dropVersionsOfMissingShots(p);
    expect(kept).toBe(p);
    const dropped = dropVersionsOfMissingShots({ ...p, shots: p.shots.filter((s) => s.id !== 'S01') });
    expect(dropped.versions).toEqual({});
  });
});

describe('diffSentences', () => {
  it('相同文本全部为 same', () => {
    expect(diffSentences('甲。乙。', '甲。乙。').every((o) => o.type === 'same')).toBe(true);
  });
  it('改动一句：旧句删除、新句新增，其余不变', () => {
    const ops = diffSentences('镜头一。镜头二。镜头三。', '镜头一。镜头二改。镜头三。');
    expect(ops.map((o) => o.type)).toEqual(['same', 'removed', 'added', 'same']);
    expect(ops[1].text).toBe('镜头二。');
    expect(ops[2].text).toBe('镜头二改。');
  });
  it('空对非空', () => {
    expect(diffSentences('', '甲。').map((o) => o.type)).toEqual(['added']);
    expect(diffSentences('甲。', '').map((o) => o.type)).toEqual(['removed']);
  });
});
