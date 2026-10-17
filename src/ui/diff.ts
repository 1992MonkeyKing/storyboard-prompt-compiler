// “句”级对比：切分与 LCS diff，用于预览高亮。
//
// splitSentences 把输出切成“句”：每句 = { leading, text }，
// leading 是句前的空白（换行/空格），text 是句子正文。
// 渲染时 leading 放在高亮 span 之外，差异对比只看 text——
// 换行符和空白不参与差异高亮，不会再出现句首的黄色竖条。

export interface SentenceToken {
  /** 句子前的空白，渲染时放在高亮 span 之外 */
  leading: string;
  /** 句子正文（无首尾空白），参与差异对比 */
  text: string;
}

export function splitSentences(text: string): { tokens: SentenceToken[]; trailing: string } {
  const tokens: SentenceToken[] = [];
  const re = /(\s*)([^\s。！？][^。！？]*[。！？]?)/g;
  let m: RegExpExecArray | null;
  let lastEnd = 0;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) break; // 防御：空匹配时退出，避免死循环
    tokens.push({ leading: m[1], text: m[2] });
    lastEnd = m.index + m[0].length;
  }
  return { tokens, trailing: text.slice(lastEnd) };
}

/**
 * 返回与 newTexts 等长的 boolean 数组：true 表示该句相对旧文本是新增/变化的。
 * 用 LCS 求最长公共子序列，未落在 LCS 中的新句子即视为变化。
 */
export function diffHighlight(oldTexts: string[], newTexts: string[]): boolean[] {
  const n = oldTexts.length;
  const m = newTexts.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        oldTexts[i] === newTexts[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const res = new Array<boolean>(m).fill(true);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldTexts[i] === newTexts[j]) {
      res[j] = false;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return res;
}
