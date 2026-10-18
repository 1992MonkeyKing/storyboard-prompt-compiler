// 拆解提示词组装：正文来自 data/breakdown-prompt.json（数据），
// {景别选项} 等占位符由 vocab/zh.json 的选项填充。本文件不写任何提示词措辞。
import promptJson from '../../data/breakdown-prompt.json';
import { vocabField, type VocabPath } from './vocab';

const PLACEHOLDERS: Record<string, VocabPath> = {
  景别选项: 'shotSize',
  角度选项: 'angle',
  运镜类型选项: 'move.type',
  幅度选项: 'move.amount',
  速度选项: 'move.speed',
  方向选项: 'move.direction',
};

/** 生成完整的剧本拆解提示词（复制后贴进任意 LLM）。 */
export function buildBreakdownPrompt(): string {
  let body: string = (promptJson as { body: string }).body;
  for (const [name, path] of Object.entries(PLACEHOLDERS)) {
    const field = vocabField(path);
    const options = field.options.filter((o) => o !== '').join('、');
    body = body.split(`{${name}}`).join(options);
  }
  return body;
}
