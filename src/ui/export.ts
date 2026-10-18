// 导出与复制：TXT / CSV / 项目 JSON / 剪贴板。纯函数 + 浏览器小工具，无提示词措辞。
import { compile, listPlatforms } from '../lib/compile';
import type { Project, Shot } from '../lib/types';

/** 按镜头类型匹配平台（video→Seedance，image→Seedream）。 */
export function platformForShot(shot: Shot): string {
  const platforms = listPlatforms();
  return (platforms.find((t) => t.kind === shot.kind) ?? platforms[0]).id;
}

export function platformName(id: string): string {
  return listPlatforms().find((t) => t.id === id)?.name ?? id;
}

export interface ParamDisplay {
  ratio: string;
  resolution: string;
  seed: string;
}

export function paramDisplay(shot: Shot): ParamDisplay {
  const p = shot.params ?? {};
  return {
    ratio: p.ratio ?? '未设置',
    resolution: p.resolution ?? '未设置',
    seed: p.seed == null ? '未设置' : String(p.seed),
  };
}

/** 预览区参数行（单行显示用）。 */
export function paramsLine(shot: Shot): string {
  const d = paramDisplay(shot);
  return `比例 ${d.ratio} · 分辨率 ${d.resolution} · 种子 ${d.seed}`;
}

/** 复制参数用的多行文本。 */
export function paramsCopyText(shot: Shot): string {
  const d = paramDisplay(shot);
  return `比例：${d.ratio}\n分辨率：${d.resolution}\n种子：${d.seed}`;
}

function compileSafe(project: Project, shot: Shot, platformId: string): string {
  try {
    return compile(project, shot.id, platformId);
  } catch (e) {
    return `[编译失败：${e instanceof Error ? e.message : String(e)}]`;
  }
}

/** 全片 TXT：按镜号排列，每镜用其类型匹配的平台编译。 */
export function buildTxt(project: Project): string {
  const parts: string[] = [];
  for (const shot of project.shots) {
    const pid = platformForShot(shot);
    parts.push(`[${shot.id}] ${shot.label}（${platformName(pid)}）`);
    parts.push(compileSafe(project, shot, pid));
    parts.push('');
    parts.push('----------------------------------------');
    parts.push('');
  }
  return parts.join('\n').trim() + '\n';
}

/** CSV 字段转义：含逗号/引号/换行则加引号，引号双写。 */
export function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** 全片 CSV：镜号、平台、提示词、参数（带 BOM，Excel 直接打开不乱码）。 */
export function buildCsv(project: Project): string {
  const rows = ['镜号,平台,提示词,参数'];
  for (const shot of project.shots) {
    const pid = platformForShot(shot);
    const prompt = compileSafe(project, shot, pid);
    const d = paramDisplay(shot);
    const params = `比例=${d.ratio};分辨率=${d.resolution};种子=${d.seed}`;
    rows.push([shot.id, platformName(pid), prompt, params].map(csvEscape).join(','));
  }
  return '\uFEFF' + rows.join('\n') + '\n';
}

/** 触发浏览器下载。 */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 复制到剪贴板（Clipboard API 不可用时回退到 textarea）。 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** 项目 JSON 导出文本。 */
export function projectJsonText(project: Project): string {
  return JSON.stringify(project, null, 2);
}

/**
 * 解析项目 JSON（导入用）：结构不对或解析失败返回 null。
 * 结构校验只看顶层 cards / assets / shots 三个数组。
 */
export function parseProjectJson(text: string): Project | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const d = data as Record<string, unknown>;
  if (
    !d ||
    typeof d !== 'object' ||
    Array.isArray(d) ||
    !Array.isArray(d.cards) ||
    !Array.isArray(d.assets) ||
    !Array.isArray(d.shots)
  ) {
    return null;
  }
  return data as Project;
}
