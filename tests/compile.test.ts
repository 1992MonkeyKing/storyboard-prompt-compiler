// 验收测试 T1–T5（对应 SPEC.md 第七部分；T2 期望输出逐字取自 SPEC.md 第四部分）
import { describe, expect, it } from 'vitest';
import { compile } from '../src/lib/compile';
import type { ImageShot, Project, VideoShot } from '../src/lib/types';
import exampleJson from '../examples/xtech-tvc.json';

const project = exampleJson as unknown as Project;

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

// SPEC.md 第四部分给出的验收文本（逐字）
const EXPECTED_S01 = [
  '图片1：提供产品外形、颜色和字样；保留产品结构与字样；不取背景。',
  '产品广告开场镜头：银色磨砂质感的无线蓝牙耳机，圆角方形充电盒，盒盖正面印有"X-TECH"字样，纯白无缝背景，空气中有细微尘埃粒子，干净通透的商业广告质感，柔和顶光，金属边缘有细亮高光。',
  '0-2秒：中近景，平视，缓慢小幅前推。充电盒盒盖缓缓打开。',
  '2-5秒：中近景，平视，平稳向右环绕。两只耳机从盒中缓缓升起并旋转半周。',
  '声音：盒盖打开的轻微咔哒声，耳机升起时的轻微电子音。无背景音乐。不要字幕。产品结构和字样与参考图一致，画面中只有一副耳机。',
].join('\n');

const EXPECTED_S02 =
  '电商产品主图：图一提供产品外形、颜色和字样，保留产品结构与字样，不取背景。银色磨砂质感的无线蓝牙耳机，圆角方形充电盒，盒盖正面印有"X-TECH"字样，盒盖打开约 75 度，两只耳机斜靠在盒内，整体向右倾斜约 15 度，纯白无缝背景。中近景，居中构图，平视。充电盒为磨砂铝合金质感，耳塞为液态硅胶质感，干净通透的商业广告质感，柔和顶光，金属边缘有细亮高光。保持产品结构完整，盒内只有两只耳机。';

function findVideoShot(p: Project, id: string): VideoShot {
  const s = p.shots.find((x) => x.id === id);
  if (!s || s.kind !== 'video') throw new Error(`找不到视频镜头 ${id}`);
  return s;
}

function findImageShot(p: Project, id: string): ImageShot {
  const s = p.shots.find((x) => x.id === id);
  if (!s || s.kind !== 'image') throw new Error(`找不到图像镜头 ${id}`);
  return s;
}

/** 逐行 diff，返回发生变化的行号 */
function diffLines(before: string, after: string): number[] {
  const b = before.split('\n');
  const a = after.split('\n');
  const changed: number[] = [];
  const n = Math.max(b.length, a.length);
  for (let i = 0; i < n; i++) {
    if (b[i] !== a[i]) changed.push(i);
  }
  return changed;
}

describe('T1 确定性', () => {
  it('同一项目连续编译 100 次，输出逐字一致（视频/图像）', () => {
    const firstVideo = compile(project, 'S01', 'seedance-2.5');
    for (let i = 0; i < 100; i++) {
      expect(compile(project, 'S01', 'seedance-2.5')).toBe(firstVideo);
    }
    const firstImage = compile(project, 'S02', 'seedream');
    for (let i = 0; i < 100; i++) {
      expect(compile(project, 'S02', 'seedream')).toBe(firstImage);
    }
  });
});

describe('T2 样例一致', () => {
  it('S01 / Seedance 2.5 编译结果与规格文本逐字一致', () => {
    expect(compile(project, 'S01', 'seedance-2.5')).toBe(EXPECTED_S01);
  });
  it('S02 / Seedream 编译结果与规格文本逐字一致', () => {
    expect(compile(project, 'S02', 'seedream')).toBe(EXPECTED_S02);
  });
});

describe('T3 单变量', () => {
  it('只改幅度“小”→“中”，输出只有对应那一句不同', () => {
    const before = compile(project, 'S01', 'seedance-2.5');
    const modified = clone(project);
    findVideoShot(modified, 'S01').segments[0].move.amount = '中';
    const after = compile(modified, 'S01', 'seedance-2.5');

    const changed = diffLines(before, after);
    expect(changed).toEqual([2]); // 只有第 3 行（0-2秒那句）变化
    expect(after.split('\n')[2]).toContain('缓慢前推');
    expect(after.split('\n')[2]).not.toContain('小幅');
  });
});

describe('T4 空值', () => {
  function assertClean(out: string) {
    expect(out).not.toContain('，，');
    expect(out).not.toContain('。。');
    expect(out).not.toContain('（）');
    expect(out).not.toContain('()');
    for (const line of out.split('\n')) {
      expect(line.trim().length).toBeGreaterThan(0); // 无空行
      expect(line).not.toMatch(/^[，。、；：？！…·—]/); // 行首无标点
    }
  }

  it('视频镜头清空全部可选字段后无残留标点', () => {
    const modified = clone(project);
    const s01 = findVideoShot(modified, 'S01');
    s01.purpose = '';
    s01.environment = '';
    s01.light = '';
    s01.color = '';
    s01.material = '';
    s01.sfx = '';
    s01.music = '';
    s01.subtitles = true; // true → 不输出
    s01.keep = [];
    s01.dialogue = [];
    for (const seg of s01.segments) seg.action = '';
    assertClean(compile(modified, 'S01', 'seedance-2.5'));
  });

  it('图像镜头清空全部可选字段后无残留标点', () => {
    const modified = clone(project);
    const s02 = findImageShot(modified, 'S02');
    s02.purpose = '';
    s02.action = '';
    s02.environment = '';
    s02.shotSize = '';
    s02.composition = '';
    s02.angle = '';
    s02.light = '';
    s02.color = '';
    s02.material = '';
    s02.keep = [];
    s02.text = null;
    assertClean(compile(modified, 'S02', 'seedream'));
  });
});

describe('T5 档案引用', () => {
  it('修改档案卡描述：引用它的镜头同步更新，其他镜头不变', () => {
    const modified = clone(project);
    // 加一个不引用任何档案卡的对照镜头
    modified.shots.push({
      id: 'SX',
      kind: 'video',
      label: '对照镜头',
      status: '草稿',
      purpose: '对照',
      duration: 3,
      assetIds: [],
      subjectCard: '',
      subject: '一只白猫',
      environment: '客厅',
      styleCard: '',
      segments: [
        {
          start: 0,
          end: 3,
          shotSize: '中景',
          angle: '平视',
          move: { type: '固定', amount: '', speed: '', direction: '' },
          action: '白猫走过',
        },
      ],
      dialogue: [],
      sfx: '',
      music: '',
      subtitles: true,
      keep: [],
      params: {},
    });

    const beforeS01 = compile(modified, 'S01', 'seedance-2.5');
    const beforeSX = compile(modified, 'SX', 'seedance-2.5');

    const card = modified.cards.find((c) => c.id === 'product');
    if (!card) throw new Error('找不到 product 卡');
    card.description = '黑色哑光质感的无线蓝牙耳机';

    const afterS01 = compile(modified, 'S01', 'seedance-2.5');
    const afterSX = compile(modified, 'SX', 'seedance-2.5');

    expect(afterSX).toBe(beforeSX); // 未引用卡的镜头逐字不变
    expect(afterS01).not.toBe(beforeS01);
    expect(afterS01).toContain('黑色哑光质感的无线蓝牙耳机');
    expect(afterS01).not.toContain('银色磨砂质感');
    // S01 只有主体那一句变化
    expect(diffLines(beforeS01, afterS01)).toEqual([1]);
  });
});
