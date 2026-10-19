// 实测修复（茶叶蛋脚本）：画面文字、分段音效、旁白、景深/播放速度、画幅、校验误报。
import { describe, expect, it } from 'vitest';
import { compile } from '../src/lib/compile';
import type { Project, VideoShot } from '../src/lib/types';
import { buildBreakdownPrompt } from '../src/ui/breakdown';
import { checkVocabValues, normalizeShot } from '../src/ui/importer';
import { repeatedPhrases, validateShot } from '../src/ui/validate';
import exampleJson from '../examples/xtech-tvc.json';

const VIDEO = 'seedance-2.5';
const fresh = (): Project => JSON.parse(JSON.stringify(exampleJson)) as Project;
const s01 = (p: Project) => p.shots.find((s) => s.id === 'S01') as VideoShot;
const withShot = (p: Project, shot: VideoShot): Project => ({
  ...p,
  shots: p.shots.map((s) => (s.id === shot.id ? shot : s)),
});

describe('画面文字', () => {
  it('写在对应分段里，并把“不要字幕”换成不矛盾的说法', () => {
    const p = fresh();
    const v = s01(p);
    const segs = v.segments.map((g, i) =>
      i === 1 ? { ...g, text: { content: '古法慢卤 · 礼盒即食', position: '画面下方居中', style: '淡金色书法字' } } : g,
    );
    const out = compile(withShot(p, { ...v, subtitles: false, segments: segs }), 'S01', VIDEO);
    const lines = out.split('\n');
    const seg2 = lines.find((l) => l.startsWith('2-5秒'))!;
    expect(seg2).toContain('画面出现文字“古法慢卤 · 礼盒即食”，位于画面下方居中，淡金色书法字。');
    expect(out).toContain('除指定画面文字外不要其他字幕');
    expect(out).not.toContain('。不要字幕');
  });

  it('没有画面文字时仍输出“不要字幕”，且不留痕迹', () => {
    const out = compile(fresh(), 'S01', VIDEO);
    expect(out).toContain('不要字幕');
    expect(out).not.toContain('画面出现文字');
    expect(out).not.toContain('音效：');
  });
});

describe('分段音效', () => {
  it('写在各自分段，镜头级环境声仍在“声音”句', () => {
    const p = fresh();
    const v = s01(p);
    const segs = v.segments.map((g, i) => ({ ...g, sfx: i === 0 ? '卤汤咕嘟声' : '卤汁滴落声' }));
    const out = compile(withShot(p, { ...v, segments: segs, sfx: '轻微环境底噪' }), 'S01', VIDEO);
    const lines = out.split('\n');
    expect(lines.find((l) => l.startsWith('0-2秒'))).toContain('音效：卤汤咕嘟声。');
    expect(lines.find((l) => l.startsWith('2-5秒'))).toContain('音效：卤汁滴落声。');
    expect(out).toContain('声音：轻微环境底噪。');
  });
});

describe('旁白', () => {
  it('角色为“旁白”时不写成“旁白台词”；其他角色不变', () => {
    const p = fresh();
    const v = s01(p);
    const dialogue = [
      { character: '旁白', emotion: '温润低沉', line: '慢卤凝香', segment: 1 },
      { character: '店主', emotion: '', line: '刚出锅', segment: 2 },
    ];
    const out = compile(withShot(p, { ...v, dialogue }), 'S01', VIDEO);
    expect(out).toContain('旁白（温润低沉）：“慢卤凝香”');
    expect(out).not.toContain('旁白台词');
    expect(out).toContain('店主台词：“刚出锅”');
  });
});

describe('景深与播放速度', () => {
  it('跟在运镜后面，空值不留痕迹', () => {
    const p = fresh();
    const v = s01(p);
    const segs = v.segments.map((g, i) =>
      i === 0 ? { ...g, focus: '浅景深背景虚化', playback: '升格慢动作' } : g,
    );
    const out = compile(withShot(p, { ...v, segments: segs }), 'S01', VIDEO);
    expect(out).toContain('缓慢小幅前推，浅景深背景虚化，升格慢动作。');
    expect(out.split('\n').find((l) => l.startsWith('2-5秒'))).not.toMatch(/，。/);
  });
});

describe('拆解与导入', () => {
  it('拆解提示词包含新字段与规则', () => {
    const text = buildBreakdownPrompt();
    expect(text).toContain('"params": {"ratio": ""}');
    expect(text).toContain('升格慢动作');
    expect(text).toContain('变焦推近');
    expect(text).toContain('text.content');
    expect(text).toContain('不要补充原文没有的场景');
  });

  it('导入保留分段的音效、画面文字、景深、播放速度和画幅', () => {
    const shot = normalizeShot({
      id: 'S01',
      kind: 'video',
      params: { ratio: '9:16' },
      segments: [
        { start: 0, end: 3, sfx: '咕嘟声', focus: '浅景深背景虚化', playback: '升格慢动作', text: '礼藏本味' },
        { start: 3, end: 6, text: { content: '古法慢卤', position: '下方', style: '书法' } },
      ],
    }) as VideoShot;
    expect(shot.params.ratio).toBe('9:16');
    expect(shot.segments[0]).toMatchObject({ sfx: '咕嘟声', focus: '浅景深背景虚化', playback: '升格慢动作' });
    expect(shot.segments[0].text).toEqual({ content: '礼藏本味', position: '', style: '' });
    expect(shot.segments[1].text?.content).toBe('古法慢卤');
  });

  it('播放速度走词表校验，“慢镜头”建议改为“升格慢动作”', () => {
    const w = checkVocabValues([{ id: 'S01', kind: 'video', segments: [{ playback: '慢镜头' }] }]);
    expect(w).toHaveLength(1);
    expect(w[0].suggestion).toBe('升格慢动作');
  });
});

describe('校验', () => {
  it('没有画幅比例时提示', () => {
    const p = fresh();
    const v = s01(p);
    const hints = validateShot(p, { ...v, params: {} }).map((h) => h.message);
    expect(hints.some((m) => m.includes('未设置画幅比例'))).toBe(true);
  });

  it('动作里提到字幕却没填画面文字时提示；填了就不提示', () => {
    const p = fresh();
    const v = s01(p);
    const bad = v.segments.map((g, i) => (i === 1 ? { ...g, action: `${g.action}，淡金色书法字幕浮现` } : g));
    expect(validateShot(p, { ...v, segments: bad }).some((h) => h.message.includes('第2段动作里提到了文字'))).toBe(true);
    const good = bad.map((g, i) => (i === 1 ? { ...g, text: { content: '礼藏本味', position: '', style: '' } } : g));
    expect(validateShot(p, { ...v, segments: good }).some((h) => h.message.includes('提到了文字'))).toBe(false);
  });

  it('纯时间戳不算重复短语', () => {
    expect(repeatedPhrases('0-3秒：甲乙丙丁。声音：0-3秒咕嘟声')).toEqual([]);
    expect(repeatedPhrases('背景轻微虚化，背景轻微虚化')).toEqual(['背景轻微虚化']);
    expect(repeatedPhrases('浅景深背景虚化。甲乙丙丁，浅景深背景虚化')).toEqual([]);
  });
});
