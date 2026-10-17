// 独立审查用的刁难测试（不在 SPEC 验收清单内，用于发现边界问题）
import { describe, expect, it } from 'vitest';
import { compile } from '../src/lib/compile';
import { splitSentences, diffHighlight } from '../src/ui/diff';
import type { Project, VideoShot, ImageShot } from '../src/lib/types';
import exampleJson from '../examples/xtech-tvc.json';

const base = exampleJson as unknown as Project;
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
const sentences = (s: string) => splitSentences(s).tokens.map((t) => t.text);
const changedCount = (a: string, b: string) => {
  // 按句 LCS：变化/新增句数 + 被删除句数
  const A = sentences(a), B = sentences(b);
  const added = diffHighlight(A, B).filter(Boolean).length;
  const removed = diffHighlight(B, A).filter(Boolean).length;
  return Math.max(added, removed);
};

describe('A1 单变量（逐字段，按句判断）', () => {
  const videoMut: [string, (s: VideoShot) => void][] = [
    ['purpose', (s) => (s.purpose = '新用途')],
    ['environment', (s) => (s.environment = '黑色背景')],
    ['light', (s) => (s.light = '侧逆光')],
    ['seg0.shotSize', (s) => (s.segments[0].shotSize = '特写')],
    ['seg0.angle', (s) => (s.segments[0].angle = '俯视')],
    ['seg0.move.speed', (s) => (s.segments[0].move.speed = '快速')],
    ['seg1.move.direction', (s) => (s.segments[1].move.direction = '向左')],
    ['seg1.action', (s) => (s.segments[1].action = '耳机静止')],
    ['sfx', (s) => (s.sfx = '清脆提示音')],
    ['music', (s) => (s.music = '轻柔铺底')],
    ['subtitles', (s) => (s.subtitles = true)],
  ];
  for (const [name, mut] of videoMut) {
    it(`视频 ${name}`, () => {
      const p = clone(base);
      const before = compile(p, 'S01', 'seedance-2.5');
      mut(p.shots.find((x) => x.id === 'S01') as VideoShot);
      const after = compile(p, 'S01', 'seedance-2.5');
      expect(changedCount(before, after)).toBe(1);
    });
  }
  const imageMut: [string, (s: ImageShot) => void][] = [
    ['purpose', (s) => (s.purpose = '详情页配图')],
    ['shotSize', (s) => (s.shotSize = '特写')],
    ['composition', (s) => (s.composition = '对角线')],
    ['material', (s) => (s.material = '亮面金属')],
  ];
  for (const [name, mut] of imageMut) {
    it(`图像 ${name}`, () => {
      const p = clone(base);
      const before = compile(p, 'S02', 'seedream');
      mut(p.shots.find((x) => x.id === 'S02') as ImageShot);
      const after = compile(p, 'S02', 'seedream');
      expect(changedCount(before, after)).toBe(1);
    });
  }
});

describe('A2 字段缺失（导入 JSON 时 LLM 可能漏字段）', () => {
  it('素材缺 keep 字段时，不应把镜头的 keep 数组串进素材句', () => {
    const p = clone(base);
    delete (p.assets[0] as Partial<typeof p.assets[0]>).keep;
    const out = compile(p, 'S01', 'seedance-2.5');
    expect(out.split('\n')[0]).not.toContain('画面中只有一副耳机');
  });
  it('分段缺 action 时，不应借用镜头层同名字段', () => {
    const p = clone(base);
    const s = p.shots.find((x) => x.id === 'S01') as VideoShot & { action?: string };
    s.action = '镜头层动作';
    delete (s.segments[0] as Partial<typeof s.segments[0]>).action;
    const out = compile(p, 'S01', 'seedance-2.5');
    expect(out).not.toContain('镜头层动作');
  });
});

describe('A3 用户文本中的标点与换行', () => {
  it('动作以问号结尾时，不应出现“？。”', () => {
    const p = clone(base);
    (p.shots[0] as VideoShot).segments[0].action = '她回头问：是你吗？';
    expect(compile(p, 'S01', 'seedance-2.5')).not.toContain('？。');
  });
  it('环境里有换行时，不应打乱行结构（仍为 5 行）', () => {
    const p = clone(base);
    (p.shots[0] as VideoShot).environment = '纯白无缝背景\n空气中有细微尘埃粒子';
    expect(compile(p, 'S01', 'seedance-2.5').split('\n').length).toBe(5);
  });
});

describe('A4 素材类型与平台不匹配', () => {
  it('图像镜头引用视频素材、用 Seedream 编译时，不应出现英文兜底标签', () => {
    const p = clone(base);
    p.assets.push({ id: 'v1', kind: 'video', file: 'ref.mp4', role: '提供运镜', keep: '', exclude: '' });
    (p.shots[1] as ImageShot).assetIds.push('v1');
    expect(compile(p, 'S02', 'seedream')).not.toMatch(/video\d/);
  });
});

describe('A5 措辞全部来自模板（为英文平台做准备）', () => {
  it('换一套英文 phrases，输出中不残留任何代码内置的中文措辞', async () => {
    const { compileWithTemplate } = await import('../src/lib/compile');
    const p = clone(base);
    const s = p.shots.find((x) => x.id === 'S01') as VideoShot;
    s.segments[0].move = { type: '固定', amount: '', speed: '', direction: '' };
    s.dialogue = [{ character: 'Lin', emotion: 'surprised', line: 'Is it you?', segment: 1 }];
    const tpl = {
      id: 'test-en', name: 'test', kind: 'video' as const, lang: 'en',
      assetLabel: { image: '@Image{n}' },
      phrases: {
        listJoin: ', ', move: '{speed} {amount} {type}',
        moveAmount: { 小: 'slight', 中: '', 大: 'large' },
        moveTypeOverride: { 固定: 'Static camera' },
        dialogue: '{character}[ ({emotion})]: "{line}"', dialogueJoin: ' ',
        musicMap: { 无: 'No background music' }, musicCustom: 'Music: {value}',
        subtitlesOff: 'No subtitles', subtitlesOn: '',
      },
      body: '{#each segments}{moveText}. {dialogueText}\n{/each}[{musicText}. ][{subtitleText}.]',
    };
    const out = compileWithTemplate(p, s, tpl);
    expect(out).toContain('Static camera');
    expect(out).toContain('Lin (surprised): "Is it you?"');
    expect(out).toContain('No background music. No subtitles.');
    for (const zh of ['镜头固定', '无背景音乐', '不要字幕', '台词', '小幅']) expect(out).not.toContain(zh);
  });
});
