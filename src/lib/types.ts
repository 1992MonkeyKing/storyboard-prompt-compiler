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
  /** 景深 / 焦点（词表 focus，可自填） */
  focus?: string;
  /** 播放速度（词表 playback，如 升格慢动作） */
  playback?: string;
  /** 本分段的音效（与时间轴同步） */
  sfx?: string;
  /** 本分段出现的画面文字（广告语、标题等，逐字保留） */
  text?: ShotText | null;
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
  /** 定稿版本快照，按镜头 id 分组（阶段 4）；旧项目文件可以没有此字段 */
  versions?: Record<string, ShotVersion[]>;
}

/**
 * 镜头定稿快照：保存定稿那一刻的镜头数据、它引用的档案卡和素材，
 * 以及当时按各个同类型平台编译出的提示词全文。
 */
export interface ShotVersion {
  /** 该镜头内的版本序号，从 1 开始 */
  n: number;
  /** ISO 时间字符串（仅用于显示，不参与编译） */
  savedAt: string;
  shot: Shot;
  cards: Card[];
  assets: Asset[];
  /** 平台 id → 当时的编译结果 */
  prompts: Record<string, string>;
}

export interface PlatformTemplate {
  id: string;
  name: string;
  kind: 'video' | 'image';
  lang: string;
  /** 按素材类型编号的标签格式，{n} 为阿拉伯数字，{cn} 为中文数字 */
  assetLabel: Record<string, string>;
  /** 派生字段用到的全部措辞（由各平台自定义；代码中不写任何措辞） */
  phrases: PlatformPhrases;
  body: string;
}

/**
 * 平台措辞。所有取值都是数据；缺失的项按空串处理（对应内容不输出）。
 * 其中带 {字段} 的项是小模板，用与 body 相同的语法渲染。
 */
export interface PlatformPhrases {
  /** 列表连接符，用于 keepText、主体/风格卡片与补充的拼接 */
  listJoin?: string;
  /** 运镜文字小模板，可用字段：{speed}{amount}{direction}{type}（amount 已经过 moveAmount 映射） */
  move?: string;
  /** 幅度词映射，如 {"小": "小幅", "中": ""} */
  moveAmount?: Record<string, string>;
  /** 按运镜类型整体替换，如 {"固定": "镜头固定"}（命中时忽略速度、幅度、方向） */
  moveTypeOverride?: Record<string, string>;
  /** 台词小模板，可用字段：{character}{emotion}{line} */
  dialogue?: string;
  /** 同一分段多条台词的连接符 */
  dialogueJoin?: string;
  /** 音乐取值映射，如 {"无": "无背景音乐"}；未命中时用 musicCustom */
  musicMap?: Record<string, string>;
  /** 自定义音乐小模板，可用字段：{value} */
  musicCustom?: string;
  /** subtitles 为 false 时输出的文字 */
  subtitlesOff?: string;
  /** subtitles 为 true 时输出的文字（通常为空） */
  subtitlesOn?: string;
  /** subtitles 为 false 但分段里有画面文字时输出的文字（避免与画面文字矛盾）；未定义时用 subtitlesOff */
  subtitlesOffWithText?: string;
  /** 视为画外音的角色名，如 ["旁白", "画外音"]；命中时台词改用 narration 小模板 */
  narratorNames?: string[];
  /** 旁白小模板，可用字段：{character}{emotion}{line}；未定义时仍用 dialogue */
  narration?: string;
}
