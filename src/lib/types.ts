// 分镜提示词编译器 · 数据模型（对应 SPEC.md 第二部分）

export type ShotStatus = '草稿' | '待审' | '定稿';

export interface Card {
  id: string;
  /** 产品 | 角色 | 场景 | 风格 */
  type: string;
  name: string;
  description: string;
  assetIds?: string[];
}

export type AssetKind = 'image' | 'video' | 'audio';

export interface Asset {
  id: string;
  kind: AssetKind;
  /** 登记的文件名 */
  file: string;
  /** 素材职责 */
  role: string;
  keep: string;
  exclude: string;
}

export interface Move {
  type: string;
  amount: string;
  speed: string;
  direction: string;
}

export interface Segment {
  start: number;
  end: number;
  shotSize: string;
  angle: string;
  move: Move;
  action: string;
}

export interface DialogueLine {
  character: string;
  emotion: string;
  line: string;
  /** 所属分段序号（从 1 开始）；不填则归入最后一段 */
  segment?: number;
}

export interface ShotText {
  content: string;
  position: string;
  style: string;
}

export interface ShotParams {
  ratio?: string;
  resolution?: string;
  seed?: number | null;
  [key: string]: unknown;
}

interface ShotBase {
  id: string;
  kind: 'video' | 'image';
  label: string;
  status: ShotStatus;
  purpose: string;
  subjectCard: string;
  subject: string;
  environment: string;
  styleCard: string;
  assetIds: string[];
  keep: string[];
  /** 参数不进提示词 */
  params: ShotParams;
}

export interface VideoShot extends ShotBase {
  kind: 'video';
  duration: number;
  segments: Segment[];
  dialogue: DialogueLine[];
  sfx: string;
  music: string;
  subtitles: boolean;
  /** 模板同时引用这三个字段（见示例项目 S01） */
  light?: string;
  color?: string;
  material?: string;
}

export interface ImageShot extends ShotBase {
  kind: 'image';
  action: string;
  shotSize: string;
  composition: string;
  angle: string;
  light: string;
  color: string;
  material: string;
  style: string;
  text?: ShotText | null;
}

export type Shot = VideoShot | ImageShot;

export interface Project {
  project: {
    id: string;
    name: string;
    version: string;
    defaultPlatform: string;
  };
  cards: Card[];
  assets: Asset[];
  shots: Shot[];
}

export interface PlatformTemplate {
  id: string;
  name: string;
  kind: 'video' | 'image';
  lang: string;
  /** 按素材类型编号的标签格式，{n} 为阿拉伯数字，{cn} 为中文数字 */
  assetLabel: Record<string, string>;
  body: string;
}
