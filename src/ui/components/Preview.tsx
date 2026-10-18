import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { compile, listPlatforms, unsupportedAssets } from '../../lib/compile';
import type { Project } from '../../lib/types';
import { diffHighlight, splitSentences } from '../diff';
import { paramsCopyText, paramsLine } from '../export';
import { CopyButton } from './controls';
import { validateShot } from '../validate';
import { versionsOf } from '../versions';
import VersionsModal from './VersionsModal';

interface Props {
  project: Project;
  shotId: string | null;
  platformId: string;
  onPlatformChange: (id: string) => void;
}

/**
 * 编译预览：每次数据变化即时重编；与“上一次编译结果”按句对比，
 * 只有新增/变化的句子高亮（换行与空白不参与对比、不进高亮 span）。
 * 切换镜头或平台时重置对比基线。
 *
 * 平台与镜头类型不匹配时（如视频镜头选了图像平台），显示提示而不输出提示词。
 *
 * 注意：高亮是“数据变化”驱动的状态（存在 useState 里），而不是每次 render
 * 重算——否则顶栏自动保存等无关重渲染会把高亮冲掉。
 */
export default function Preview({ project, shotId, platformId, onPlatformChange }: Props) {
  const platforms = useMemo(() => listPlatforms(), []);
  const baseKey = `${shotId ?? ''}||${platformId}`;
  const prevRef = useRef<{ key: string; output: string } | null>(null);
  const [highlight, setHighlight] = useState<boolean[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const shot = shotId ? (project.shots.find((s) => s.id === shotId) ?? null) : null;
  const tpl = platforms.find((p) => p.id === platformId) ?? null;
  const mismatched = shot !== null && tpl !== null && tpl.kind !== shot.kind;

  let output: string | null = null;
  let error: string | null = null;
  if (shot && !mismatched) {
    try {
      output = compile(project, shot.id, platformId);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  const hints = shot ? validateShot(project, shot) : [];
  const versionCount = shot ? versionsOf(project, shot.id).length : 0;
  const skipped = shot && !mismatched ? unsupportedAssets(project, shot.id, platformId) : [];
  const { tokens, trailing } = useMemo(
    () => (output === null ? { tokens: [], trailing: '' } : splitSentences(output)),
    [output],
  );

  // 只在编译输出或基线 key 真正变化时重算高亮
  useEffect(() => {
    const prev = prevRef.current;
    if (output === null) {
      prevRef.current = null;
      setHighlight([]);
      return;
    }
    if (!prev || prev.key !== baseKey) {
      setHighlight(tokens.map(() => false));
    } else {
      setHighlight(
        diffHighlight(
          splitSentences(prev.output).tokens.map((t) => t.text),
          tokens.map((t) => t.text),
        ),
      );
    }
    prevRef.current = { key: baseKey, output };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [output, baseKey]);

  let body: ReactNode;
  if (!shot) {
    body = <div className="empty-hint">在中间栏选择一个镜头，这里实时显示编译结果</div>;
  } else if (mismatched) {
    body = <div className="preview-error">该平台不支持此镜头类型</div>;
  } else if (error !== null) {
    body = <div className="preview-error">{error}</div>;
  } else {
    body = (
      <div className="preview-text">
        {tokens.map((t, i) => (
          <Fragment key={i}>
            {t.leading}
            <span className={highlight[i] ? 'sent changed' : 'sent'}>{t.text}</span>
          </Fragment>
        ))}
        {trailing}
      </div>
    );
  }

  return (
    <div className="preview">
      <div className="preview-head">
        <span className="panel-title">编译预览</span>
        <select value={platformId} onChange={(e) => onPlatformChange(e.target.value)} aria-label="切换平台">
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {shot && (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => setVersionsOpen(true)}
            title="定稿时自动保存版本，可任选两个版本逐句对比"
          >
            版本（{versionCount}）
          </button>
        )}
        {output !== null && (
          <CopyButton label="复制提示词" getText={() => output} title="复制当前镜头的编译提示词" />
        )}
      </div>
      {shot && output !== null && (
        <div className="preview-params">
          <span className="params-text">参数：{paramsLine(shot)}</span>
          <CopyButton label="复制参数" getText={() => paramsCopyText(shot)} title="复制比例 / 分辨率 / 种子" />
        </div>
      )}
      {skipped.length > 0 && (
        <div className="preview-warning">
          该平台不支持此类素材，以下素材未写入提示词：{skipped.map((a) => a.file || a.id).join('、')}
        </div>
      )}
      {hints.length > 0 && (
        <ul className="hint-list">
          {hints.map((h, i) => (
            <li key={i} className={`hint hint-${h.level}`}>
              {h.level === 'warn' ? '⚠' : 'ℹ'} {h.message}
            </li>
          ))}
        </ul>
      )}
      <div className="preview-body">{body}</div>
      {versionsOpen && shot && (
        <VersionsModal project={project} shot={shot} platformId={platformId} onClose={() => setVersionsOpen(false)} />
      )}
    </div>
  );
}
