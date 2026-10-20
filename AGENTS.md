本项目是“分镜提示词编译器”，完整规格见 SPEC.md（以仓库内 SPEC.md 为准）。

## 当前状态

SPEC.md 第八部分的阶段 0–4 已全部完成，另有一轮“实测修复”（见 SPEC.md 同名小节）。
不要从头重建项目；在现有代码上增量修改。

## 必须遵守的三条硬规则

1. 编译是纯函数：输出只由项目数据和模板决定，不调用 LLM、不用随机数、不依赖当前时间。
2. 模板和词表是数据：放在 templates/*.json 和 vocab/*.json，不在代码中写死任何平台措辞。
3. 空值不留痕迹：可选块中任一字段为空则整块省略，输出中不能出现多余标点或空括号。

## 常用命令

- 安装：`npm ci`
- 测试：`npm test`（全部必须通过）
- 类型检查：`npm run typecheck`
- 本地运行：`npm run dev`

每次改动后运行测试和类型检查，不通过不得提交。

## 文件地图

- `src/lib/compile.ts`：编译引擎（派生字段 → 模板渲染 → 规范化）。
- `src/lib/types.ts`：数据模型。
- `templates/*.json`：各平台模板与措辞（phrases）。
- `vocab/zh.json`：受控词表与别名表。
- `data/breakdown-prompt.json`：剧本拆解提示词（词表选项由代码自动填入）。
- `src/ui/`：界面；`validate.ts` 校验提示，`versions.ts` 定稿快照与版本对比，`importer.ts` 导入校验。
- `examples/`：`xtech-tvc.json` 示例项目（T1–T5 逐字验收），`teaegg-breakdown.json` 真实脚本拆解样例。
- `tests/`：compile（逐字验收）、audit（边界）、stage3、stage4、fixes-teaegg。

## 改动原则

- 措辞不对：先改 templates/ 或 vocab/ 的数据；数据改不了才改代码。
- 不得改变示例项目 S01、S02 的编译结果（tests/compile.test.ts 逐字比对），除非任务明确要求并同步更新 SPEC.md。
- 新增平台：新建一个 templates/<id>.json，并在 compile.ts 的模板注册表里登记，补测试。
- 新增字段：同步更新 types.ts、importer.ts（导入规整）、ShotEditor.tsx（表单）、拆解提示词、SPEC.md 和测试。
- 界面文字用中文。
