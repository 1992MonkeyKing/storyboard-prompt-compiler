// 表单基础控件。镜头语言下拉框（VocabSelect）的选项全部来自词表字段对象，
// 本文件不写死任何选项文字。
import { useState } from 'react';
import { copyText } from '../export';
import type { VocabField } from '../vocab';

interface FieldProps {
  label?: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <span className="field-control">{children}</span>
    </label>
  );
}

export function TextInput(props: {
  label?: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={props.label}>
      <input
        type="text"
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </Field>
  );
}

export function TextArea(props: {
  label?: string;
  value: string;
  rows?: number;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={props.label}>
      <textarea
        value={props.value}
        rows={props.rows ?? 2}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </Field>
  );
}

export function NumberInput(props: {
  label?: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={props.label}>
      <input
        type="number"
        value={props.value}
        min={props.min}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </Field>
  );
}

export function CheckBox(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="checkbox">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span>{props.label}</span>
    </label>
  );
}

const CUSTOM_VALUE = '__custom__';

/**
 * 词表下拉框：选项来自传入的 VocabField（即 vocab/zh.json）。
 * allowCustom 为 true 时，下拉之外可输入自定义值。
 */
export function VocabSelect(props: {
  label?: string;
  field: VocabField;
  value: string;
  onChange: (v: string) => void;
}) {
  const { field, value, onChange } = props;
  const inOptions = field.options.includes(value);
  const selValue = field.allowCustom ? (inOptions ? value : CUSTOM_VALUE) : value;
  return (
    <Field label={props.label}>
      <span className="vocab-select">
        <select
          value={selValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v !== CUSTOM_VALUE) onChange(v);
          }}
        >
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o === '' ? '（空）' : o}
            </option>
          ))}
          {!inOptions && !field.allowCustom && <option value={value}>（词表外：{value}）</option>}
          {field.allowCustom && <option value={CUSTOM_VALUE}>自定义…</option>}
        </select>
        {field.allowCustom && selValue === CUSTOM_VALUE && (
          <input
            type="text"
            value={value}
            placeholder="输入自定义值"
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </span>
    </Field>
  );
}

/** 应用级枚举下拉框：选项来自调用方传入的 {value,label} 数组（见 appOptions.json）。 */
export function AppSelect(props: {
  label?: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={props.label}>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** 复制按钮：点击复制 getText() 的文本，成功后短暂显示“已复制”。 */
export function CopyButton(props: { label: string; getText: () => string; title?: string }) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-small"
      title={props.title}
      onClick={async () => {
        const ok = await copyText(props.getText());
        if (ok) {
          setDone(true);
          setFailed(false);
          window.setTimeout(() => setDone(false), 1500);
        } else {
          setFailed(true);
          window.setTimeout(() => setFailed(false), 2000);
        }
      }}
    >
      {failed ? '复制失败' : done ? '已复制 ✓' : props.label}
    </button>
  );
}

/** 字符串数组编辑器（用于 keep 等）。 */
export function StringListEditor(props: {
  label?: string;
  values: string[];
  placeholder?: string;
  onChange: (v: string[]) => void;
}) {
  const { values, onChange } = props;
  return (
    <div className="field">
      {props.label && <span className="field-label">{props.label}</span>}
      <span className="field-control">
        {values.map((v, i) => (
          <span key={i} className="list-row">
            <input
              type="text"
              value={v}
              placeholder={props.placeholder}
              onChange={(e) => {
                const next = values.slice();
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
            >
              删除
            </button>
          </span>
        ))}
        <button type="button" className="btn btn-ghost" onClick={() => onChange([...values, ''])}>
          ＋ 添加
        </button>
      </span>
    </div>
  );
}
