// 词表读取层：界面所有镜头语言下拉框的选项都从 vocab/zh.json 来，
// tsx 代码里不写死任何选项文字。
import vocabJson from '../../vocab/zh.json';

export interface VocabField {
  label: string;
  options: string[];
  allowCustom: boolean;
}

interface VocabRoot {
  shotSize: VocabField;
  angle: VocabField;
  move: {
    type: VocabField;
    amount: VocabField;
    speed: VocabField;
    direction: VocabField;
  };
  composition: VocabField;
  light: VocabField;
  music: VocabField;
}

const vocab = vocabJson as unknown as VocabRoot;

export type VocabPath =
  | 'shotSize'
  | 'angle'
  | 'composition'
  | 'light'
  | 'music'
  | 'move.type'
  | 'move.amount'
  | 'move.speed'
  | 'move.direction';

/** 按路径取词表字段，如 vocabField('move.type')。 */
export function vocabField(path: VocabPath): VocabField {
  let cur: unknown = vocab;
  for (const part of path.split('.')) {
    cur = (cur as Record<string, unknown>)[part];
  }
  if (!cur || typeof cur !== 'object') {
    throw new Error(`词表缺少字段: ${path}`);
  }
  return cur as VocabField;
}
