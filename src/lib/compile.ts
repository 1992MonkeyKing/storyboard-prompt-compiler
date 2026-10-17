// 分镜提示词编译器 · 编译引擎（对应 SPEC.md 第四部分）
//
// 三条硬规则的落实：
// 1. 纯函数：compile 的输出只由 (project, shotId, platformId) 与 templates/*.json 决定，
//    不调用 LLM、不用随机数、不依赖当前时间。
// 2. 模板和词表是数据：平台措辞全部来自 templates/*.json；本文件只实现语法与规则。
// 3. 空值不留痕迹：可选块任一字段为空则整块省略，规范化清理残留标点。
//
// 模板语法：{字段}（支持 a.b 路径）、[可选块]（可嵌套）、{#each 列表}…{/each}、\n 换行。

import type {
  Asset,
  DialogueLine,
  Move,
  PlatformTemplate,
  Project,
  Shot,
  VideoShot,
} from './types';
import seedanceTemplateJson from '../../templates/seedance-2.5.json';
import seedreamTemplateJson from '../../templates/seedream.json';

// ---------------------------------------------------------------------------
// 模板注册表（从数据文件加载，不在代码里写任何平台措辞）
// ---------------------------------------------------------------------------

const TEMPLATES: Record<string, PlatformTemplate> = {
  [seedanceTemplateJson.id]: seedanceTemplateJson as PlatformTemplate,
  [seedreamTemplateJson.id]: seedreamTemplateJson as PlatformTemplate,
};

export function listPlatforms(): PlatformTemplate[] {
  return Object.values(TEMPLATES);
}

// ---------------------------------------------------------------------------
// 对外主入口：compile(project, shotId, platformId)
// ---------------------------------------------------------------------------

export function compile(project: Project, shotId: string, platformId: string): string {
  const shot = project.shots.find((s) => s.id === shotId);
  if (!shot) throw new Error(`未知镜头 id: ${shotId}`);
  const template = TEMPLATES[platformId];
  if (!template) throw new Error(`未知平台 id: ${platformId}`);
  return compileWithTemplate(project, shot, template);
}

/** 同一引擎，允许传入任意模板对象（便于测试与将来新增平台）。 */
export function compileWithTemplate(
  project: Project,
  shot: Shot,
  template: PlatformTemplate,
): string {
  const ctx = buildContext(project, shot, template);
  const raw = renderNodes(parseTemplate(template.body), ctx);
  return normalize(raw);
}

// ---------------------------------------------------------------------------
// 第一步：派生字段（对应 SPEC.md 第四部分 §1）
// ---------------------------------------------------------------------------

type Ctx = Record<string, unknown>;

function buildContext(project: Project, shot: Shot, template: PlatformTemplate): Ctx {
  const cards = new Map(project.cards.map((c) => [c.id, c]));
  const assetsById = new Map(project.assets.map((a) => [a.id, a]));

  // 素材按类型分别计数，顺序即 project.assets 中的上传顺序
  const counters: Record<string, number> = {};
  const numberOf = new Map<string, number>();
  for (const a of project.assets) {
    counters[a.kind] = (counters[a.kind] ?? 0) + 1;
    numberOf.set(a.id, counters[a.kind]);
  }

  const assets = shot.assetIds
    .map((id) => assetsById.get(id))
    .filter((a): a is Asset => a !== undefined)
    .map((a) => {
      const n = numberOf.get(a.id) ?? 0;
      return { ...a, n, cn: toChineseNumeral(n), label: assetLabel(template, a.kind, n) };
    });

  const subjectText = joinWithComma(cards.get(shot.subjectCard)?.description ?? '', shot.subject);
  const styleExtra = (shot as { style?: string }).style ?? '';
  const styleText = joinWithComma(cards.get(shot.styleCard)?.description ?? '', styleExtra);

  let segments: Ctx[] = [];
  let musicText = '';
  let subtitleText = '';
  if (shot.kind === 'video') {
    const v = shot as VideoShot;
    const total = v.segments.length;
    segments = v.segments.map((seg, i) => ({
      ...seg,
      moveText: buildMoveText(seg.move),
      dialogueText: dialogueTextForSegment(v.dialogue, i + 1, total),
    }));
    musicText =
      v.music === '无' ? '无背景音乐' : v.music ? `背景音乐：${v.music}` : '';
    subtitleText = v.subtitles === false ? '不要字幕' : '';
  }

  const keepText = shot.keep.join('，');

  return {
    ...shot,
    subjectText,
    styleText,
    assets,
    segments,
    musicText,
    subtitleText,
    keepText,
  };
}

function joinWithComma(base: string, extra: string): string {
  const b = (base ?? '').trim();
  const e = (extra ?? '').trim();
  if (b && e) return `${b}，${e}`;
  return b || e;
}

/** 素材标签：按模板 assetLabel 格式生成，如“图片1”“图一”。 */
function assetLabel(template: PlatformTemplate, kind: string, n: number): string {
  const fmt = template.assetLabel[kind];
  if (!fmt) return `${kind}${n}`; // 模板未定义该类型时的确定性兜底
  return fmt.replace('{n}', String(n)).replace('{cn}', toChineseNumeral(n));
}

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 中文数字（一、二、……、九十九、一百……），支持到 9999。 */
export function toChineseNumeral(n: number): string {
  if (!Number.isInteger(n) || n <= 0) return String(n);
  if (n < 10) return CN_DIGITS[n];
  if (n < 20) return n === 10 ? '十' : `十${CN_DIGITS[n - 10]}`;
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return `${CN_DIGITS[t]}十${o ? CN_DIGITS[o] : ''}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return `${CN_DIGITS[h]}百${rest ? toChineseNumeral(rest) : ''}`;
  }
  if (n < 10000) {
    const th = Math.floor(n / 1000);
    const rest = n % 1000;
    return `${CN_DIGITS[th]}千${rest ? toChineseNumeral(rest) : ''}`;
  }
  return String(n);
}

const AMOUNT_WORD: Record<string, string> = {
  微: '轻微',
  小: '小幅',
  中: '', // “中”不写
  大: '大幅',
};

/**
 * 运镜文字组合规则（SPEC.md 第三部分）：
 * 顺序固定为 速度 + 幅度 + 方向 + 类型；类型为“固定”时直接输出“镜头固定”。
 */
export function buildMoveText(move?: Move | null): string {
  if (!move || !move.type) return '';
  if (move.type === '固定') return '镜头固定';
  const amountWord = AMOUNT_WORD[move.amount] ?? move.amount ?? '';
  return `${move.speed ?? ''}${amountWord}${move.direction ?? ''}${move.type}`;
}

function formatDialogueLine(d: DialogueLine): string {
  const emotion = d.emotion ? `（${d.emotion}）` : '';
  return `${d.character}台词${emotion}：“${d.line}”`;
}

/**
 * 某分段的台词文本：segment 字段（从 1 开始）指向对应分段；
 * 未填 segment 的放进最后一段；超出范围的也归入最后一段。
 * 同一段多条台词用“；”连接。
 */
function dialogueTextForSegment(
  dialogue: DialogueLine[],
  index1Based: number,
  total: number,
): string {
  if (total === 0) return '';
  const lines = dialogue.filter((d) => {
    const target =
      d.segment == null
        ? total
        : d.segment >= 1 && d.segment <= total
          ? d.segment
          : total;
    return target === index1Based;
  });
  return lines.map(formatDialogueLine).join('；');
}

// ---------------------------------------------------------------------------
// 第二步：模板解析与渲染
// ---------------------------------------------------------------------------

type Node =
  | { type: 'text'; value: string }
  | { type: 'field'; path: string }
  | { type: 'optional'; children: Node[] }
  | { type: 'each'; listPath: string; children: Node[] };

export function parseTemplate(src: string): Node[] {
  let pos = 0;

  function parseSequence(endMarker?: string): Node[] {
    const nodes: Node[] = [];
    let buf = '';
    const flush = () => {
      if (buf) {
        nodes.push({ type: 'text', value: buf });
        buf = '';
      }
    };
    while (pos < src.length) {
      if (endMarker && src.startsWith(endMarker, pos)) break;
      if (src.startsWith('{#each', pos)) {
        const m = /^\{#each\s+([^{}]+)\}/.exec(src.slice(pos));
        if (!m) {
          buf += src[pos];
          pos += 1;
          continue;
        }
        flush();
        pos += m[0].length;
        const children = parseSequence('{/each}');
        pos += '{/each}'.length;
        nodes.push({ type: 'each', listPath: m[1].trim(), children });
        continue;
      }
      const ch = src[pos];
      if (ch === '[') {
        flush();
        pos += 1;
        const children = parseSequence(']');
        pos += 1; // 跳过 ']'
        nodes.push({ type: 'optional', children });
        continue;
      }
      if (ch === '{') {
        const m = /^\{([^{}]+)\}/.exec(src.slice(pos));
        if (m) {
          flush();
          pos += m[0].length;
          nodes.push({ type: 'field', path: m[1].trim() });
          continue;
        }
      }
      buf += ch;
      pos += 1;
    }
    flush();
    return nodes;
  }

  return parseSequence();
}

function resolvePath(ctx: Ctx, path: string): unknown {
  let cur: unknown = ctx;
  for (const key of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/**
 * 字段值清洗（规范化第 1 步）：去首尾空格，去末尾的“。”“，”“；”。
 * 数组兜底用“，”连接（模板里正常都用派生字段，不会走到这里）。
 */
function cleanValue(v: unknown): string {
  if (v == null) return '';
  let s = Array.isArray(v) ? v.join('，') : String(v);
  s = s.trim().replace(/[。，；]+$/, '');
  return s;
}

function renderNodes(nodes: Node[], ctx: Ctx): string {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') {
      out += n.value;
    } else if (n.type === 'field') {
      out += cleanValue(resolvePath(ctx, n.path));
    } else if (n.type === 'each') {
      const list = resolvePath(ctx, n.listPath);
      if (Array.isArray(list)) {
        for (const item of list) {
          out += renderNodes(n.children, { ...ctx, ...(item as Ctx) });
        }
      }
    } else {
      // optional：块内“本级”任一字段为空则整块省略；嵌套块各自独立判断
      if (optionalKept(n.children, ctx)) {
        const inner = renderNodes(n.children, ctx);
        if (inner !== '') out += inner;
      }
    }
  }
  return out;
}

/** 可选块本级直接引用的字段（不含嵌套块与循环内部的字段）。 */
function directFieldPaths(nodes: Node[]): string[] {
  const paths: string[] = [];
  for (const n of nodes) {
    if (n.type === 'field') paths.push(n.path);
  }
  return paths;
}

function optionalKept(children: Node[], ctx: Ctx): boolean {
  return directFieldPaths(children).every((p) => cleanValue(resolvePath(ctx, p)) !== '');
}

// ---------------------------------------------------------------------------
// 第三步：规范化（对应 SPEC.md 第四部分 §3，按顺序执行）
// ---------------------------------------------------------------------------

const LEADING_PUNCT = new Set(['，', '。', '、', '；', '：', '？', '！', '…', '·', '—']);

export function normalize(raw: string): string {
  // 2. 合并重复标点（循环到稳定）。
  //    规格列出“，，”“，。。”“。。”三种；“。,”→“。”是 T2 逐字验收所必需的：
  //    Seedream 模板中 [{light}][，{color}][，{material}] 一组在 light/color 为空时，
  //    [，{material}] 保留的前导“，”会落在上一句的“。”之后形成“。，“，
  //    验收文本要求此处为“平视。充电盒”，故补足此条（同属“合并重复标点”一类）。
  let s = raw;
  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s
      .replace(/，，/g, '，')
      .replace(/，。/g, '。')
      .replace(/。。/g, '。')
      .replace(/。，/g, '。');
  }
  // 3. 删除每行开头的标点，删除空行
  const lines = s.split('\n').map((line) => {
    let t = line.trim();
    while (t.length > 0 && LEADING_PUNCT.has(t[0])) t = t.slice(1);
    return t.trim();
  });
  return lines.filter((t) => t.length > 0).join('\n');
}
