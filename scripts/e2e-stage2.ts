// 阶段 2 端到端验证：载入示例 → 选中 S01 → 第一段幅度 小→中 → 断言高亮
// 运行：npx vite-node scripts/e2e-stage2.ts
import { chromium } from 'playwright-core';

const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const URL = 'http://127.0.0.1:5173/';
const SHOT_DIR = '/home/hatch/workspace/storyboard-compiler/docs';

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });

  // confirm 对话框一律接受
  page.on('dialog', (d) => d.accept());

  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '载入示例项目' }).click();
  await page.waitForTimeout(800);

  // 选中 S01
  await page.getByText('S01 · TVC 第 1 镜').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOT_DIR}/stage2-A.png` });

  // 分段编辑区截图：分段增删按钮 + 景别/角度/运镜类型/幅度/速度/方向下拉框
  const firstSegCard = page.locator('.segment-card').first();
  await firstSegCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOT_DIR}/stage2-segments.png` });

  // 预览应有 5 行
  const previewBefore = await page.locator('.preview-text').innerText();
  const linesBefore = previewBefore.split('\n').filter((l) => l.trim().length > 0);
  console.log('载入后预览行数 =', linesBefore.length);

  // 第一段：幅度 小 → 中（分段卡片内 vocab 下拉顺序：景别0 角度1 运镜类型2 幅度3 速度4 方向5）
  const firstSeg = page.locator('.segment-card').first();
  const amountSelect = firstSeg.locator('.vocab-select select').nth(3);
  const before = await amountSelect.inputValue();
  console.log('改前幅度 =', before);
  await amountSelect.selectOption('中');
  await page.waitForTimeout(800);

  // 断言高亮
  const changed = page.locator('.preview-text .sent.changed');
  const count = await changed.count();
  const changedTexts: string[] = [];
  for (let i = 0; i < count; i++) changedTexts.push(await changed.nth(i).innerText());
  console.log('高亮句子数 =', count);
  console.log('高亮句子 =', JSON.stringify(changedTexts));

  await page.screenshot({ path: `${SHOT_DIR}/stage2-B.png` });

  // 全量断言
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('断言失败: ' + msg);
    console.log('OK -', msg);
  };
  assert(linesBefore.length === 5, 'S01 预览为 5 行');
  assert(before === '小', '改前幅度为“小”');
  assert(count === 1, '只有一句高亮');
  assert(
    changedTexts[0].includes('0-2秒') && changedTexts[0].includes('缓慢前推'),
    '高亮句为 0-2 秒句且变为“缓慢前推”',
  );
  assert(!changedTexts[0].includes('小幅'), '高亮句不再含“小幅”');
  assert(errors.length === 0, '页面无 JS 报错' + (errors.length ? ': ' + errors.join('; ') : ''));

  // 平台/类型不匹配：S01（视频）切到 Seedream（图像平台）应显示提示而非提示词
  await page.locator('.preview-head select').selectOption('seedream');
  await page.waitForTimeout(500);
  const mismatchText = await page.locator('.preview-body').innerText();
  assert(mismatchText.includes('该平台不支持此镜头类型'), '视频镜头+图像平台显示不支持提示');
  await page.locator('.preview-head select').selectOption('seedance-2.5');
  await page.waitForTimeout(500);

  // 镜头类型切换：视频→图像（有分段数据，confirm 自动接受）
  await page.locator('.editor-head select').selectOption('image');
  await page.waitForTimeout(500);
  await page.getByText('画面文字').waitFor({ timeout: 5000 });
  console.log('OK - 视频→图像切换经确认后生效（分段数据已丢弃，显示图像字段）');

  await browser.close();
  console.log('E2E 全部通过');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
