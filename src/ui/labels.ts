// 素材标签显示：按所选平台模板的 assetLabel 格式生成（如“图片1”“图一”）。
// 不在界面代码里写死标签写法，全部来自 templates/*.json（经引擎的模板注册表）。
import { listPlatforms, toChineseNumeral } from '../lib/compile';
import type { Asset } from '../lib/types';

export function assetLabel(platformId: string, kind: string, n: number): string {
  const tpl = listPlatforms().find((t) => t.id === platformId);
  const fmt = tpl?.assetLabel[kind] ?? `${kind}{n}`;
  return fmt.replace('{n}', String(n)).replace('{cn}', toChineseNumeral(n));
}

/** 素材按类型分别计数（上传顺序），返回 id -> 编号。 */
export function assetNumbers(assets: Asset[]): Map<string, number> {
  const counters: Record<string, number> = {};
  const map = new Map<string, number>();
  for (const a of assets) {
    counters[a.kind] = (counters[a.kind] ?? 0) + 1;
    map.set(a.id, counters[a.kind]);
  }
  return map;
}
