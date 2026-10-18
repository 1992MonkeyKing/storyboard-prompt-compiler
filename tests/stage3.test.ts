// 阶段 3 单元测试：拆解提示词组装、导入校验、词表检查、导出构建。
import { vocabField } from '../src/ui/vocab';
import { describe, expect, it } from 'vitest';
import { buildBreakdownPrompt } from '../src/ui/breakdown';
import {
  checkVocabValues,
  aliasSuggestion,
  normalizeCard,
  normalizeShot,
  resolveCardConflicts,
  uniqueId,
  validateImport,
} from '../src/ui/importer';
import { buildCsv, buildTxt, csvEscape, parseProjectJson, projectJsonText } from '../src/ui/export';
import type { Card, Project } from '../src/lib/types';
import exampleJson from '../examples/xtech-tvc.json';

const example = exampleJson as unknown as Project;

describe('buildBreakdownPrompt', () => {
  it('填充全部词表占位符，不残留 {…选项}', () => {
    const text = buildBreakdownPrompt();
    expect(text).toContain('你是商业影像项目的分镜师');
    expect(text).toContain('大远景');
    expect(text).toContain('前推');
    expect(text).not.toMatch(/\{.+选项\}/);
  });
});

describe('validateImport', () => {
  const valid = JSON.stringify({
    cards: [{ id: 'c1', type: '产品', name: '耳机', description: '黑' }],
    shots: [{ id: 'S01', kind: 'video', label: '开场', segments: [] }],
    questions: ['比例是多少？'],
  });
  it('合法 JSON 通过', () => {
    const { data, issues } = validateImport(valid);
    expect(issues).toEqual([]);
    expect(data?.shots).toHaveLength(1);
    expect(data?.questions).toEqual(['比例是多少？']);
  });
  it('非法 JSON 报根错误', () => {
    const { data, issues } = validateImport('{bad');
    expect(data).toBeNull();
    expect(issues[0].path).toBe('根');
  });
  it('缺 shots / 坏 kind / 重复 id 都报错', () => {
    const { issues } = validateImport(JSON.stringify({ cards: [] }));
    expect(issues.some((i) => i.path === 'shots')).toBe(true);
    const bad = JSON.stringify({
      shots: [
        { id: 'S01', kind: 'gif' },
        { id: 'S01', kind: 'video' },
      ],
    });
    const r2 = validateImport(bad);
    expect(r2.data).toBeNull();
    expect(r2.issues.some((i) => i.path === 'shots[0].kind')).toBe(true);
    expect(r2.issues.some((i) => i.message.includes('重复'))).toBe(true);
  });
});

describe('checkVocabValues', () => {
  it('标红词表外取值并给出建议；空值与可自填字段不标', () => {
    const shots = [
      {
        id: 'S01',
        kind: 'video',
        segments: [
          {
            shotSize: '超大远景',
            angle: '平视',
            move: { type: '前推', amount: '小', speed: '缓慢', direction: '' },
          },
        ],
        music: '轻柔的钢琴曲', // allowCustom，不标
      },
    ];
    const warnings = checkVocabValues(shots);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].fieldLabel).toBe('第1段·景别');
    expect(warnings[0].value).toBe('超大远景');
    expect(warnings[0].suggestion).toBe(''); // “超大远景”不在别名表中，不猜测
    expect(warnings[0].options).toContain('大远景'); // 提供全部合法选项供自选
  });
});

describe('normalizeShot / resolveCardConflicts / uniqueId', () => {
  it('缺失字段补默认，kind 非法默认 video', () => {
    const s = normalizeShot({ id: 'SX', kind: 'nope' });
    expect(s.kind).toBe('video');
    if (s.kind === 'video') {
      expect(s.segments).toEqual([]);
    }
    expect(s.params).toEqual({});
  });
  it('卡片冲突：keep 丢弃导入卡，rename 换新 id', () => {
    const existing: Card[] = [{ id: 'c1', type: '产品', name: '旧', description: '' }];
    const imported: Card[] = [
      { id: 'c1', type: '产品', name: '新', description: '' },
      { id: 'c2', type: '角色', name: 'R', description: '' },
    ];
    const { cardsToAdd, idMap } = resolveCardConflicts(existing, imported, { c1: 'rename' });
    expect(cardsToAdd.map((c) => c.id)).toEqual(['c1_导入2', 'c2']);
    expect(idMap['c1']).toBe('c1_导入2');
    const keep = resolveCardConflicts(existing, imported, { c1: 'keep' });
    expect(keep.cardsToAdd.map((c) => c.id)).toEqual(['c2']);
    expect(keep.idMap['c1']).toBe('c1');
  });
  it('uniqueId 跳过已占用', () => {
    expect(uniqueId('S01', new Set(['S01']))).toBe('S01_导入2');
    expect(uniqueId('S01', new Set())).toBe('S01');
  });
});

describe('T6：导出项目 JSON 再导入，数据完全一致', () => {
  it('projectJsonText → parseProjectJson 深相等', () => {
    const back = parseProjectJson(projectJsonText(example));
    expect(back).toEqual(example);
  });
  it('非法 JSON 或缺数组返回 null', () => {
    expect(parseProjectJson('{bad')).toBeNull();
    expect(parseProjectJson(JSON.stringify({ cards: [], shots: [] }))).toBeNull();
  });
});

describe('导入缺失字段补空值（不得留 undefined）', () => {
  const findUndefined = (o: unknown, path: string, out: string[]) => {
    if (o === undefined) {
      out.push(path);
      return;
    }
    if (o !== null && typeof o === 'object') {
      for (const [k, v] of Object.entries(o)) findUndefined(v, `${path}.${k}`, out);
    }
  };
  it('normalizeShot / normalizeCard 结果中无 undefined', () => {
    for (const kind of ['video', 'image'] as const) {
      const bad: string[] = [];
      findUndefined(normalizeShot({ id: 'SX', kind }), 'shot', bad);
      expect(bad).toEqual([]);
    }
    const badCard: string[] = [];
    findUndefined(normalizeCard({ id: 'c1' }), 'card', badCard);
    expect(badCard).toEqual([]);
  });
});

describe('csvEscape', () => {
  it('含逗号/引号/换行加引号，引号双写', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('a"b')).toBe('"a""b"');
    expect(csvEscape('a\nb')).toBe('"a\nb"');
    expect(csvEscape('abc')).toBe('abc');
  });
});

describe('buildTxt / buildCsv', () => {
  it('TXT 按镜号排列，含平台名', () => {
    const txt = buildTxt(example);
    expect(txt).toContain('[S01]');
    expect(txt).toContain('[S02]');
    expect(txt.indexOf('[S01]')).toBeLessThan(txt.indexOf('[S02]'));
    expect(txt).toContain('Seedance 2.5');
  });
  it('CSV 表头正确，每镜一行（提示词内换行已加引号包裹）', () => {
    const csv = buildCsv(example);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
    expect(csv).toContain('镜号,平台,提示词,参数');
    expect(csv).toContain('S01');
    expect(csv).toContain('S02');
    expect(csv).toContain('"'); // 含换行的提示词字段被引号包裹
  });
});

describe('别名建议（不做字符相似度猜测）', () => {
  const field = (path: Parameters<typeof vocabField>[0]) => vocabField(path);
  const cases: [Parameters<typeof vocabField>[0], string, string][] = [
    ['shotSize', '半身', '中景'],
    ['shotSize', '全身', '全景'],
    ['shotSize', '大头', '特写'],
    ['shotSize', 'close-up', '特写'],
    ['shotSize', 'Close-Up', '特写'],
    ['shotSize', '近景特写', '近景'],
    ['move.type', '推镜头', '前推'],
    ['move.type', '拉远', '后拉'],
    ['move.speed', '慢', '缓慢'],
  ];
  for (const [path, input, expected] of cases) {
    it(`${input} → ${expected}`, () => {
      expect(aliasSuggestion(input, field(path))).toBe(expected);
    });
  }
  it('未登记的词不给建议', () => {
    expect(aliasSuggestion('奇怪镜头', field('shotSize'))).toBe('');
    expect(aliasSuggestion('慢动作感', field('move.speed'))).toBe('');
    expect(aliasSuggestion('慢', field('move.type'))).toBe(''); // 别名按字段区分
  });
  it('所有别名都指向本字段的合法选项', () => {
    const paths = ['shotSize', 'angle', 'move.type', 'move.amount', 'move.speed', 'move.direction'] as const;
    for (const p of paths) {
      const f = field(p);
      for (const target of Object.values(f.aliases ?? {})) expect(f.options).toContain(target);
    }
  });
});
