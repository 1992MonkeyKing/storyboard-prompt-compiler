// 阶段 3 端到端验证：复制按钮 → 导入弹窗（非法JSON/问题列表/词表标红/卡片冲突）→ 确认导入
// 运行：npx vite-node scripts/e2e-stage3.ts
import { chromium } from 'playwright-core';

const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const URL = 'http://127.0.0.1:5173/';
const SHOT_DIR = '/home/hatch/workspace/storyboard-compiler/docs';

const VALID_JSON = JSON.stringify({
  cards: [{ id: 'product', type: '产品', name: 'X-TECH 耳机·新版', description: '新版描述' }],
  shots: [
    {
      id: 'S99',
      kind: 'video',
      label: '测试镜头',
      purpose: '',
      duration: 4,
      subjectCard: 'product',
      subject: '',
      environment: '',
      styleCard: '',
      segments: [
        {
          start: 0,
          end: 4,
          shotSize: '半身',
          angle: '平视',
          move: { type: '前推', amount: '小', speed: '缓慢', direction: '' },
          action: '测试动作',
        },
      ],
      dialogue: [],
      sfx: '',
      music: '',
      subtitles: false,
      keep: [],
    },
  ],
  questions: ['这个镜头的成片比例是多少？'],
});

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  page.on('dialog', (d) => d.accept());
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('断言失败: ' + msg);
    console.log('OK -', msg);
  };

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '载入示例项目' }).click();
  await page.waitForTimeout(800);
  await page.getByText('S01 · TVC 第 1 镜').click();
  await page.waitForTimeout(600);

  // 1. 复制类按钮存在
  assert(await page.getByRole('button', { name: '复制提示词' }).count() === 1, '预览区有复制提示词按钮');
  assert(await page.getByRole('button', { name: '复制参数' }).count() === 1, '预览区有复制参数按钮');
  assert((await page.locator('.preview-params').innerText()).includes('比例'), '参数行显示');
  assert(await page.getByRole('button', { name: '复制拆解提示词' }).count() === 1, '顶栏有复制拆解提示词按钮');
  for (const name of ['导入拆解JSON', '导入项目', '导出项目', '导出TXT', '导出CSV']) {
    assert(await page.getByRole('button', { name }).count() === 1, `顶栏有${name}按钮`);
  }

  // 2. 复制拆解提示词 → 反馈
  await page.getByRole('button', { name: '复制拆解提示词' }).click();
  await page.waitForTimeout(400);
  assert(await page.getByRole('button', { name: '已复制 ✓' }).count() >= 1, '复制拆解提示词反馈已复制');
  await page.waitForTimeout(1600);

  // 3. 复制提示词 → 反馈
  await page.getByRole('button', { name: '复制提示词' }).click();
  await page.waitForTimeout(400);
  assert((await page.locator('.preview-head').innerText()).includes('已复制'), '复制提示词反馈已复制');

  await page.screenshot({ path: `${SHOT_DIR}/stage3-preview.png` });

  // 4. 导入弹窗：非法 JSON
  await page.getByRole('button', { name: '导入拆解JSON' }).click();
  await page.waitForTimeout(400);
  assert(await page.locator('.modal').count() === 1, '导入弹窗打开');
  await page.locator('.import-textarea').fill('{bad json');
  await page.getByRole('button', { name: '校验并预览' }).click();
  await page.waitForTimeout(400);
  assert((await page.locator('.modal-body').innerText()).includes('不是合法的 JSON'), '非法JSON报结构错误');

  // 5. 合法 JSON：问题列表 + 词表外标红 + 卡片冲突
  await page.getByRole('button', { name: '返回修改' }).click();
  await page.waitForTimeout(300);
  await page.locator('.import-textarea').fill(VALID_JSON);
  await page.getByRole('button', { name: '校验并预览' }).click();
  await page.waitForTimeout(500);
  const bodyText = await page.locator('.modal-body').innerText();
  assert(bodyText.includes('这个镜头的成片比例是多少？'), 'questions 问题列表显示');
  assert(bodyText.includes('半身'), '词表外取值标红显示');
  assert(bodyText.includes('建议：远景'), '给出最接近的合法选项');
  assert(bodyText.includes('档案卡 id 冲突'), '卡片冲突区显示');
  assert(bodyText.includes('状态一律为“草稿”'), '导入摘要提示草稿状态');
  await page.screenshot({ path: `${SHOT_DIR}/stage3-import.png` });

  // 6. 采用建议
  await page.getByRole('button', { name: '采用建议' }).click();
  await page.waitForTimeout(300);
  assert((await page.locator('.modal-body').innerText()).includes('已采用 ✓'), '采用建议后标记已采用');

  // 7. 冲突未解决时确认导入禁用；解决后可用
  const confirmBtn = page.getByRole('button', { name: '确认导入' });
  assert(await confirmBtn.isDisabled(), '冲突未解决时确认导入禁用');
  await page.getByRole('button', { name: '重命名导入' }).click();
  await page.waitForTimeout(300);
  assert(await confirmBtn.isEnabled(), '解决冲突后确认导入可用');

  // 8. 确认导入 → 弹窗关闭，S99 进入镜头列表且为草稿
  await confirmBtn.click();
  await page.waitForTimeout(800);
  assert(await page.locator('.modal').count() === 0, '导入后弹窗关闭');
  const midText = await page.locator('.col-mid').innerText();
  assert(midText.includes('S99'), 'S99 进入镜头列表');
  assert(midText.includes('草稿'), '导入镜头状态为草稿');
  const leftText = await page.locator('.col-left').innerText();
  assert(leftText.includes('X-TECH 耳机·新版'), '重命名后的卡片进入档案卡');

  // 9. 采用建议生效：S99 第一段景别应为远景
  await page.getByText('S99 · 测试镜头').click();
  await page.waitForTimeout(600);
  const previewText = await page.locator('.preview-text').innerText();
  assert(previewText.includes('远景'), '采用建议后编译输出使用远景');

  assert(errors.length === 0, '无 JS 报错');
  console.log('ALL E2E STAGE3 PASSED, js errors =', errors.length);
  await browser.close();
}

main().catch((e) => {
  console.error('E2E FAILED:', e.message);
  process.exit(1);
});
