# DshViewModes 交接

给下一班（人或下一轮会话）。技术细节以 [TECHNICAL.md](./TECHNICAL.md) 为准；本文只写 **现在怎样、改过什么、别踩什么、下一步可以做什么**。

日期：2026-08-14
源码：`D:\Projects\dsh\plugins\dsh-output-mode`
运行：`npx @deepseek-ai/dsh web` → http://127.0.0.1:3080

---

## 一句话

这是一个 **只动浏览器展示、不改 DSH 核心** 的 bundle 插件：详尽 / 普通 / 摘要 三档。实现几乎全在 `client.js`。Node `index.mjs` 是空的。

## 当前状态（可用）

已接到本机 web profile，junction 工作正常：

```
D:\Projects\dsh\plugins\dsh-output-mode
        ↑
C:\Users\Nigel\.dsh\local-plugins\dsh-view-modes     (junction)
        ↑
C:\Users\Nigel\.dsh\profiles\web\node_modules\dsh-view-modes
```

`C:\Users\Nigel\.dsh\profiles\web\package.json` 的 `bundles` 含 `dsh-view-modes`。
`C:\Users\Nigel\.dsh\profiles\web\cordis.patch.yml` 是 `[]`（正确，不要再 insert）。

`client.js` 已通过 `node --check`。改完必须重启 web + Ctrl+F5。

### 产品行为（验收口径）

- 标题栏三段：详尽 / 普通 / 摘要；设置 → 通用 里有三张卡；`Alt+1/2/3`；`localStorage` 键 `dsh-view-modes`，默认普通。
- 显示名 `DshViewModes`，包名 / bundle id / URL 为 `dsh-view-modes`；中英文文案注册到 Harness `locale` 服务，跟随设置实时切换。
- **普通**：在每个正文区间内按探索 / 修改 / 协调等语义阶段折叠过程，不设固定条数上限；正文是硬分界，前后工具绝不跨正文合组。Think 计入相邻过程组，混合 `assistant-step` 只隐藏其中的 Think，正文始终独立展示。左侧有类型图标；点开后图标变向下箭头，并露出原生命令详情。
- **摘要**：跑的时候过程隐藏，底部 Codex 式扫光遮罩。结束后回答上方一粒胶囊，文案按类型汇总，例如「运行了 2 条命令，阅读了 3 个文件」。可点开再看步骤。
- **详尽**：不改 DOM 展示。
- 滚动时折叠标题跟文档走，不再滞留。

## 这段会话里实际改过什么

按时间：

1. 从四档收成三档；参考 `omdsh-dev/dsh-annotation` 的空 Node + 手写 client 形态。
2. 流式发送后页面 `RESULT_CODE_HUNG`：拿掉对话树 subtree observer、全树扫描、往 React header `appendChild`。
3. 过程按语义阶段折叠；Think 计入相邻过程组；正文作为硬分界；结束后过程折到顶部可展开。
4. 滚动卡死 / 「阅读了 3 个文件」标签滞留：废弃 `position: fixed` + JS `placePins`，改成行上 `::before`/`::after`。
5. 点开 Think 后面内容不下移、其它 Think 错位：用 `:has([aria-expanded="true"])` 解锁 `max-height`。
6. 普通模式点不开命令详情：收高度的选择器补上 `:not([data-dsh-om-gopen="1"]):not(:has([aria-expanded="true"]))`。
7. Think 和正文空隙过大：对 Think 的下一个兄弟做 `-14px` / `-8px`。
8. 折叠条左侧没图标：`::after` + SVG mask；展开换向下箭头。
9. 摘要胶囊消失：packed 行同时是 `grole=head`，`content: none !important` 盖掉了同一个 `::before`。已删这条，胶囊改成按 kind 计数的文案。

中途有一次 **半截迁移**（CSS 已改成行内标题，JS 还在调已删的 `ensureGroupWidget` / `placePins` / `thinkHost`）。那一版会运行时报错。当前 `client.js` 已收齐，不要再把 fixed 标签系统加回去。

## 关键文件

| 文件 | 角色 |
|---|---|
| `client.js` | 唯一实现。样式字符串 + 模式 store + 分组/胶囊/Think/遮罩 + slots |
| `index.mjs` | 空 `apply()` |
| `package.json` | `dsh.bundle` / `dsh.client`；`exports["./client"]` |
| `cordis.patch.yml` | 只 insert `id: dsh-view-modes` |
| `TECHNICAL.md` | 算法、属性表、铁律、改哪里 |

没有构建步骤，没有测试套件。检查就是 `npm run check` + 浏览器里走一轮对话。

## 绝对不要做

- 在流式热路径上对 document 开 subtree `MutationObserver`、全树 `querySelectorAll`、或往 `[data-chat-flow]` 里 `appendChild`。
- 用 hashed CSS module 类名（`Sxvs8a_body` 等）当选择器。
- 把切换器或折叠标签插进 React 拥有的 header / 对话行。
- 再用 fixed overlay 追折叠标题位置。
- 对 `[data-dsh-om-briefpack][data-dsh-om-grole=head]::before` 写 `content: none !important`。
- 在 profile / home 的 `cordis.patch.yml` 再 insert 一次同 id。
- Windows 上 `pnpm link:D:\...`（跨盘会链坏）。先 junction 到 `C:\Users\Nigel\.dsh\local-plugins\`。
- 把混合 `assistant-step` 整行标成 `data-dsh-om-grole`；只给其中的 Think 子节点写 `data-dsh-om-inline-think`，否则会连正文一起隐藏。

## 建议的验证清单

改完重启 web，Ctrl+F5，然后：

1. 普通：发一条会在两段正文前后调用同类工具的任务。正文前后必须是两个过程组；同一正文区间内的同类阶段不限数量聚合。
2. 普通：混合 `assistant-step` 的 Think 默认计入前组并隐藏；展开前组后 Think 恢复，正文仍独立且位置正常。
3. 滚动长对话：折叠标题跟行走，不留残影。
4. 摘要：跑的时候只有遮罩；结束后胶囊出现，文案按类型汇总；点开能看到步骤，再点能收起。
5. 详尽：工具卡、Think、统计都在，和没装插件时一致。
6. 切三次模式、刷新，localStorage 仍是最后一档。
7. `http://127.0.0.1:3080/plugins/dsh-view-modes/client.js` 为 200。

本轮已用 Chrome 在现有长会话中自动验收：15 段正文全部形成硬分界，混合 Think 全部回挂前组；展开 / 收起后正文保持独立，闭合标题高 24px，原生命令详情无残留。

## 已知未做 / 可后续

按优先级，都不是 blocker：

1. **`classifyTool` 误伤**：`browse` 会先被当成 `read`，网页类工具图标/文案可能不对。`task` 可能被当成 subagent。
2. **摘要内部的混种基础组** 仍可能使用通用「运行了 n 条命令」；普通模式已由 `processTitle` 按 kind 分项汇总。
3. **Think 运行预览** 没有左侧图标（只有一行字）。
4. **摘要运行中** 不展示胶囊，只靠遮罩。若希望边跑边看到「已运行 n 条」，要另做一条不依赖 `!running` 的进行中文案，且不能和 `display:none` 的过程行打架。
5. **没有自动化测试**。至少可以抽 `classifyTool` / `recapTitle` / `migrateMode` 到可 `node --test` 的纯函数。
6. **README 仍偏安装向**，和当前「行内标题 + 胶囊按 kind 汇总」不完全同步。用户向说明若要跟上，改 `README.md` / `README.zh-CN.md`。
7. **官方 DOM 若拆步方式变了**（Think 和正文不再是兄弟，或 `data-chat-flow-kind` 改名），间距和 `isAnswerStep` 会先坏。只跟稳定 `data-*`。

## 下一班从哪下手

- 改展示 / 修间距 / 修胶囊：只动 `client.js` 里样式数组和 `syncGroups` / `syncThink` / `refreshRun`。先读 TECHNICAL 第 3、5、7、8、12 节。
- 改安装或发布：`package.json`、`cordis.patch.yml`、junction，不要碰 DSH 本体。
- 新开一轮会话时，把本文件和 `TECHNICAL.md` 丢进上下文，不必再翻整段聊天记录。

## 参考

- 官方形态模板：<https://github.com/omdsh-dev/dsh-annotation>
- 对话 DOM 与 Think：`@deepseek-ai/dsh-client-ui-conversation` 的 `ReasoningRow`、`AssistantMarkdown`（Think 与正文同 body，`gap: 16px`）
- 工具行图标：`@deepseek-ai/dsh-client-ui-tool` 的 `VARIANT_ICONS`（search / read / bash / write）
- client 加载：`@deepseek-ai/dsh-client-modules`（`/plugins/<id>/client.js?rev=`）
