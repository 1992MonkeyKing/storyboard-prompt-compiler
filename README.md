# 分镜提示词编译器

把一张分镜表编译成可直接粘贴的平台提示词：**同样的输入永远得到同样的输出，改一个变量只改变对应的那一句。**

- 纯前端单页应用，无后端、无账号、不调用任何生成 API；数据保存在浏览器本地
- 支持平台：Seedance 2.5（视频）、Seedream 4.0–5.0（图像），模板与词表均为数据文件，可随时增改
- 三条硬规则：编译是纯函数；模板和词表是数据（`templates/`、`vocab/`），不在代码里写死平台措辞；空值不留痕迹

完整设计规格见 `SPEC.md`，项目协作说明见 `AGENTS.md`。

## 开发

```bash
npm install
npm run dev      # 启动开发服务器
npm test         # 运行 Vitest（T1–T5 验收测试）
npm run typecheck
```

技术栈：Vite + React + TypeScript，测试用 Vitest。

## 阶段进度

- [x] 阶段 0：项目说明（`AGENTS.md`）
- [x] 阶段 1：数据层与编译引擎（无界面），`compile(project, shotId, platformId)` 纯函数，T1–T5 全过
- [x] 阶段 2：三栏界面与实时预览（顶栏＋左档案卡/素材＋中镜头列表＋右编辑表单/编译预览），按句 LCS 高亮，localStorage 自动保存
- [ ] 阶段 3：导入、导出与复制
- [ ] 阶段 4：校验、定稿与版本对比
