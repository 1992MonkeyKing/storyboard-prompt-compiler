import type {
  Asset,
  Card,
  DialogueLine,
  ImageShot,
  Segment,
  Shot,
  VideoShot,
} from '../../lib/types';
import appOptions from '../appOptions.json';
import { assetLabel, assetNumbers } from '../labels';
import { blankDialogue, blankSegment } from '../project';
import { vocabField } from '../vocab';
import {
  AppSelect,
  CheckBox,
  NumberInput,
  StringListEditor,
  TextArea,
  TextInput,
  VocabSelect,
} from './controls';

interface Props {
  shot: Shot;
  cards: Card[];
  assets: Asset[];
  platformId: string;
  onChange: (shot: Shot) => void;
}

function cardOptions(cards: Card[]) {
  return [
    { value: '', label: '（不引用）' },
    ...cards.map((c) => ({ value: c.id, label: `${c.name}（${c.type}）` })),
  ];
}

export default function ShotEditor({ shot, cards, assets, platformId, onChange }: Props) {
  const numbers = assetNumbers(assets);

  const setCommon = (patch: Record<string, unknown>) =>
    onChange({ ...shot, ...patch } as Shot);

  /** 视频镜头是否已有实质内容（切换类型会丢弃这些数据） */
  const videoHasData = (v: VideoShot) =>
    v.segments.some(
      (s) =>
        s.action.trim() !== '' ||
        s.shotSize !== '' ||
        s.angle !== '' ||
        s.move.type !== '' ||
        s.move.amount !== '' ||
        s.move.speed !== '' ||
        s.move.direction !== '' ||
        s.start !== 0 ||
        s.end !== 0,
    ) || v.dialogue.length > 0;

  const switchKind = (kind: 'video' | 'image') => {
    if (kind === shot.kind) return;
    if (shot.kind === 'video' && videoHasData(shot)) {
      if (!window.confirm('切换为图像镜头将丢弃分段与台词数据，继续？')) return;
    }
    const common = {
      id: shot.id,
      label: shot.label,
      status: shot.status,
      purpose: shot.purpose,
      subjectCard: shot.subjectCard,
      subject: shot.subject,
      environment: shot.environment,
      styleCard: shot.styleCard,
      assetIds: shot.assetIds,
      keep: shot.keep,
      params: shot.params,
    };
    if (kind === 'video') {
      const v: VideoShot = {
        ...common,
        kind: 'video',
        duration: 5,
        segments: [blankSegment()],
        dialogue: [],
        sfx: '',
        music: '',
        subtitles: false,
      };
      onChange(v);
    } else {
      const img = shot as Partial<ImageShot>;
      const v: ImageShot = {
        ...common,
        kind: 'image',
        action: '',
        shotSize: '',
        composition: '',
        angle: '',
        light: img.light ?? '',
        color: img.color ?? '',
        material: img.material ?? '',
        style: '',
        text: null,
      };
      onChange(v);
    }
  };

  const toggleAsset = (assetId: string) => {
    const has = shot.assetIds.includes(assetId);
    setCommon({
      assetIds: has ? shot.assetIds.filter((id) => id !== assetId) : [...shot.assetIds, assetId],
    });
  };

  return (
    <div className="editor">
      <div className="editor-head">
        <span className="panel-title">编辑 · {shot.id}</span>
        <AppSelect
          options={appOptions.shotKind}
          value={shot.kind}
          onChange={(v) => switchKind(v as 'video' | 'image')}
        />
      </div>

      <div className="form-section">
        <div className="form-grid-2">
          <TextInput label="镜头名" value={shot.label} onChange={(v) => setCommon({ label: v })} />
          <AppSelect
            label="状态"
            options={appOptions.shotStatus}
            value={shot.status}
            onChange={(v) => setCommon({ status: v as Shot['status'] })}
          />
        </div>
        <TextInput label="用途" value={shot.purpose} onChange={(v) => setCommon({ purpose: v })} />
        <div className="form-grid-2">
          <AppSelect
            label="主体档案卡"
            options={cardOptions(cards)}
            value={shot.subjectCard}
            onChange={(v) => setCommon({ subjectCard: v })}
          />
          <TextInput
            label="主体补充"
            value={shot.subject}
            placeholder="接在卡片描述之后"
            onChange={(v) => setCommon({ subject: v })}
          />
        </div>
        <TextInput label="环境" value={shot.environment} onChange={(v) => setCommon({ environment: v })} />
        <AppSelect
          label="风格档案卡"
          options={cardOptions(cards)}
          value={shot.styleCard}
          onChange={(v) => setCommon({ styleCard: v })}
        />
        <div className="field">
          <span className="field-label">引用素材</span>
          <span className="field-control">
            {assets.length === 0 && <span className="empty-hint">左栏先登记素材</span>}
            {assets.map((a) => (
              <CheckBox
                key={a.id}
                label={`${assetLabel(platformId, a.kind, numbers.get(a.id) ?? 0)} ${a.file || a.id}`}
                checked={shot.assetIds.includes(a.id)}
                onChange={() => toggleAsset(a.id)}
              />
            ))}
          </span>
        </div>
        <StringListEditor
          label="保持项"
          values={shot.keep}
          placeholder="画面必须保持的内容"
          onChange={(v) => setCommon({ keep: v })}
        />
        <div className="form-grid-3">
          <TextInput
            label="比例"
            value={String(shot.params.ratio ?? '')}
            onChange={(v) => setCommon({ params: { ...shot.params, ratio: v } })}
          />
          <TextInput
            label="分辨率"
            value={String(shot.params.resolution ?? '')}
            onChange={(v) => setCommon({ params: { ...shot.params, resolution: v } })}
          />
          <TextInput
            label="种子"
            value={shot.params.seed == null ? '' : String(shot.params.seed)}
            onChange={(v) =>
              setCommon({ params: { ...shot.params, seed: v === '' ? null : Number(v) } })
            }
          />
        </div>
      </div>

      {shot.kind === 'video' ? (
        <VideoFields shot={shot} onChange={onChange} />
      ) : (
        <ImageFields shot={shot} onChange={onChange} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 视频镜头

function VideoFields({ shot, onChange }: { shot: VideoShot; onChange: (s: VideoShot) => void }) {
  const set = (patch: Partial<VideoShot>) => onChange({ ...shot, ...patch });

  const updateSegment = (idx: number, seg: Segment) => {
    set({ segments: shot.segments.map((s, i) => (i === idx ? seg : s)) });
  };
  const updateDialogue = (idx: number, d: DialogueLine) => {
    set({ dialogue: shot.dialogue.map((x, i) => (i === idx ? d : x)) });
  };

  return (
    <div className="form-section">
      <h4>视频</h4>
      <div className="form-grid-3">
        <NumberInput label="时长（秒）" value={shot.duration} min={0} onChange={(v) => set({ duration: v })} />
        <TextInput label="光线" value={shot.light ?? ''} onChange={(v) => set({ light: v })} />
        <TextInput label="色彩" value={shot.color ?? ''} onChange={(v) => set({ color: v })} />
      </div>
      <TextInput label="材质" value={shot.material ?? ''} onChange={(v) => set({ material: v })} />

      <div className="sub-head">
        <span>分段（{shot.segments.length}）</span>
        <button type="button" className="btn btn-small" onClick={() => set({ segments: [...shot.segments, blankSegment()] })}>
          ＋ 添加分段
        </button>
      </div>
      {shot.segments.map((seg, i) => (
        <div key={i} className="segment-card">
          <div className="sub-head">
            <span>第 {i + 1} 段</span>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => set({ segments: shot.segments.filter((_, j) => j !== i) })}
            >
              删除
            </button>
          </div>
          <div className="form-grid-3">
            <NumberInput label="开始（秒）" value={seg.start} min={0} onChange={(v) => updateSegment(i, { ...seg, start: v })} />
            <NumberInput label="结束（秒）" value={seg.end} min={0} onChange={(v) => updateSegment(i, { ...seg, end: v })} />
            <VocabSelect label="景别" field={vocabField('shotSize')} value={seg.shotSize} onChange={(v) => updateSegment(i, { ...seg, shotSize: v })} />
          </div>
          <div className="form-grid-2">
            <VocabSelect label="角度" field={vocabField('angle')} value={seg.angle} onChange={(v) => updateSegment(i, { ...seg, angle: v })} />
            <VocabSelect label="运镜类型" field={vocabField('move.type')} value={seg.move.type} onChange={(v) => updateSegment(i, { ...seg, move: { ...seg.move, type: v } })} />
          </div>
          <div className="form-grid-3">
            <VocabSelect label="幅度" field={vocabField('move.amount')} value={seg.move.amount} onChange={(v) => updateSegment(i, { ...seg, move: { ...seg.move, amount: v } })} />
            <VocabSelect label="速度" field={vocabField('move.speed')} value={seg.move.speed} onChange={(v) => updateSegment(i, { ...seg, move: { ...seg.move, speed: v } })} />
            <VocabSelect label="方向" field={vocabField('move.direction')} value={seg.move.direction} onChange={(v) => updateSegment(i, { ...seg, move: { ...seg.move, direction: v } })} />
          </div>
          <TextArea label="动作" value={seg.action} onChange={(v) => updateSegment(i, { ...seg, action: v })} />
        </div>
      ))}

      <div className="sub-head">
        <span>台词（{shot.dialogue.length}）</span>
        <button type="button" className="btn btn-small" onClick={() => set({ dialogue: [...shot.dialogue, blankDialogue()] })}>
          ＋ 添加台词
        </button>
      </div>
      {shot.dialogue.map((d, i) => (
        <div key={i} className="segment-card">
          <div className="form-grid-3">
            <TextInput label="角色" value={d.character} onChange={(v) => updateDialogue(i, { ...d, character: v })} />
            <TextInput label="情绪" value={d.emotion} onChange={(v) => updateDialogue(i, { ...d, emotion: v })} />
            <TextInput
              label="所属分段"
              value={d.segment == null ? '' : String(d.segment)}
              placeholder="空=最后一段"
              onChange={(v) => updateDialogue(i, { ...d, segment: v === '' ? undefined : Number(v) })}
            />
          </div>
          <TextArea label="台词（逐字保留）" value={d.line} onChange={(v) => updateDialogue(i, { ...d, line: v })} />
          <button type="button" className="btn btn-ghost btn-small" onClick={() => set({ dialogue: shot.dialogue.filter((_, j) => j !== i) })}>
            删除这条台词
          </button>
        </div>
      ))}

      <TextArea label="音效" value={shot.sfx} onChange={(v) => set({ sfx: v })} />
      <div className="form-grid-2">
        <VocabSelect label="音乐" field={vocabField('music')} value={shot.music} onChange={(v) => set({ music: v })} />
        <CheckBox label="需要字幕" checked={shot.subtitles} onChange={(v) => set({ subtitles: v })} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 图像镜头

function ImageFields({ shot, onChange }: { shot: ImageShot; onChange: (s: ImageShot) => void }) {
  const set = (patch: Partial<ImageShot>) => onChange({ ...shot, ...patch });
  const text = shot.text ?? { content: '', position: '', style: '' };
  const setText = (patch: Partial<typeof text>) => set({ text: { ...text, ...patch } });

  return (
    <div className="form-section">
      <h4>图像（单画面）</h4>
      <TextArea label="动作 / 画面内容" value={shot.action} onChange={(v) => set({ action: v })} />
      <TextInput label="环境" value={shot.environment} onChange={(v) => set({ environment: v })} />
      <div className="form-grid-3">
        <VocabSelect label="景别" field={vocabField('shotSize')} value={shot.shotSize} onChange={(v) => set({ shotSize: v })} />
        <VocabSelect label="构图" field={vocabField('composition')} value={shot.composition} onChange={(v) => set({ composition: v })} />
        <VocabSelect label="角度" field={vocabField('angle')} value={shot.angle} onChange={(v) => set({ angle: v })} />
      </div>
      <div className="form-grid-3">
        <VocabSelect label="光线" field={vocabField('light')} value={shot.light} onChange={(v) => set({ light: v })} />
        <TextInput label="色彩" value={shot.color} onChange={(v) => set({ color: v })} />
        <TextInput label="材质" value={shot.material} onChange={(v) => set({ material: v })} />
      </div>
      <TextInput label="风格补充" value={shot.style} placeholder="接在风格卡描述之后" onChange={(v) => set({ style: v })} />
      <div className="form-grid-3">
        <TextInput label="画面文字" value={text.content} onChange={(v) => setText({ content: v })} />
        <TextInput label="文字位置" value={text.position} onChange={(v) => setText({ position: v })} />
        <TextInput label="文字样式" value={text.style} onChange={(v) => setText({ style: v })} />
      </div>
    </div>
  );
}
