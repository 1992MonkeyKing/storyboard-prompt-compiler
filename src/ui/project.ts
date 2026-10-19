// 项目数据操作：新建、载入示例、空对象工厂。选项默认值取自 appOptions.json。
import { listPlatforms } from '../lib/compile';
import type { Asset, Card, DialogueLine, Project, Segment, Shot } from '../lib/types';
import exampleJson from '../../examples/xtech-tvc.json';
import appOptions from './appOptions.json';

let uidCounter = 0;
export function uid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}${uidCounter}`;
}

export function defaultPlatformId(): string {
  return listPlatforms()[0]?.id ?? '';
}

export function newProject(name = '未命名项目'): Project {
  return {
    project: { id: uid('p'), name, version: '1.0', defaultPlatform: defaultPlatformId() },
    cards: [],
    assets: [],
    shots: [],
  };
}

export function loadExampleProject(): Project {
  return JSON.parse(JSON.stringify(exampleJson)) as Project;
}

export function blankCard(): Card {
  return {
    id: uid('card'),
    type: appOptions.cardType[0].value,
    name: '新卡片',
    description: '',
  };
}

export function blankAsset(): Asset {
  return {
    id: uid('asset'),
    kind: appOptions.assetKind[0].value as Asset['kind'],
    file: '',
    role: '',
    keep: '',
    exclude: '',
  };
}

export function blankSegment(): Segment {
  return {
    start: 0,
    end: 3,
    shotSize: '',
    angle: '',
    move: { type: '', amount: '', speed: '', direction: '' },
    action: '',
    focus: '',
    playback: '',
    sfx: '',
    text: null,
  };
}

export function blankDialogue(): DialogueLine {
  return { character: '', emotion: '', line: '' };
}

export function blankShot(kind: 'video' | 'image'): Shot {
  const common = {
    id: uid('shot'),
    label: kind === 'video' ? '新视频镜头' : '新图像镜头',
    status: appOptions.shotStatus[0].value as Shot['status'],
    purpose: '',
    subjectCard: '',
    subject: '',
    environment: '',
    styleCard: '',
    assetIds: [] as string[],
    keep: [] as string[],
    params: {},
  };
  if (kind === 'video') {
    return {
      ...common,
      kind: 'video',
      duration: 5,
      segments: [blankSegment()],
      dialogue: [],
      sfx: '',
      music: '',
      subtitles: false,
    };
  }
  return {
    ...common,
    kind: 'image',
    action: '',
    shotSize: '',
    composition: '',
    angle: '',
    light: '',
    color: '',
    material: '',
    style: '',
    text: null,
  };
}

/** 数组元素从 from 移动到 to（拖动排序用）。 */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
