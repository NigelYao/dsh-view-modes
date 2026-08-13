# DshViewModes 技术说明

面向后续维护者。用户向说明见 [README.zh-CN.md](./README.zh-CN.md)。

## 1. 这是什么

DSH Web 的 **输出模式** 插件。不改对话数据，只改「已经渲染出来的对话」看起来有多详细。

三档：

| 模式 | `data-dsh-omode` | 行为 |
|---|---|---|
| 详尽 | `verbose` | 不改展示，DSH 原样 |
| 普通 | `normal`（默认） | 同一正文区间内按语义阶段折叠过程；Think 计入相邻过程组；正文是硬分界 |
| 摘要 | `summary` | 跑的时候只留进度遮罩；结束后过程收成回答上方一粒胶囊，可展开 |

第四档 `basic` 已去掉（和两边都重叠）。旧值迁移：`detailed → verbose`，`basic/brief → summary`。

形态是官方 **bundle 插件**：`dsh.bundle` + `dsh.client`，Node half 为空，全部能力在浏览器 `client.js`。零核心改动。

对外显示名是 `DshViewModes`；npm 包名、ModuleLoader id、Cordis bundle id 和插件 URL 统一为 `dsh-view-modes`。

## 2. 仓库与接入

```
dsh-view-modes/
  package.json          name 必须是 dsh-view-modes；dsh.bundle + dsh.client
  index.mjs             Node apply() 空实现
  client.js             浏览器端全部逻辑（手写 CJS + ModuleLoader，无构建）
  cordis.patch.yml      只 insert 一次自身 id
  README.md / README.zh-CN.md
  TECHNICAL.md          本文件
```

`package.json` 关键声明：

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": {
    "inject": [
      "@deepseek-ai/dsh-client-runtime",
      "@deepseek-ai/dsh-client-locale",
      "@deepseek-ai/dsh-client-ui-conversation",
      "@deepseek-ai/dsh-client-ui-slots",
      "@deepseek-ai/dsh-client-ui-settings",
      "@deepseek-ai/dsh-client-ui-settings-general"
    ],
    "platform": "web"
  }
}
```

`client.js` 入口必须是：

```js
window.__ModuleLoader__.load({
  id: 'dsh-view-modes',   // 必须与 package.json name 完全一致
  factory: (require) => { ... return module.exports }
})
```

否则 client-modules 报：`bundle loaded without registering "dsh-view-modes"`。

本地开发（本机已接好）：

- 源码：`D:\Projects\dsh\plugins\dsh-output-mode`
- 同盘 junction：`C:\Users\Nigel\.dsh\local-plugins\dsh-view-modes` → 上面的源码
- profile：`C:\Users\Nigel\.dsh\profiles\web` 的 `bundles` 含 `dsh-view-modes`
- profile 依赖：`link:C:/Users/Nigel/.dsh/local-plugins/dsh-view-modes`
- profile 的 `cordis.patch.yml` 必须保持 `[]`，**不要再 insert 一次同 id**

Windows 跨盘不能直接 `pnpm link:D:\...`：pnpm 会在 C: 下做出损坏目标。必须先 junction 到 `%USERPROFILE%\.dsh\local-plugins\`。

改完 `client.js` 后要 **重启** `npx @deepseek-ai/dsh web`。client-modules 用内容哈希做 `?rev=`，boot graph 在进程启动时编好；只硬刷新有时仍吃到旧 rev。

## 3. 性能铁律（违反会卡死页面）

流式输出时 React 每个 token 都会重协调。下面三条在热路径上做了就会 `RESULT_CODE_HUNG`：

1. 对 `document` / 对话树做 **subtree `MutationObserver`**
2. 每个 token **`querySelectorAll` 全树扫描**
3. 往 **React 拥有的对话节点里 `appendChild`**

允许的做法：

- 展示尽量只靠 CSS（`html[data-dsh-omode]` + 稳定 `data-*`）
- 运行态只订 `sessions.list` / 当前 `session.subscribe`，`requestAnimationFrame` 节流
- 只遍历 `[data-chat-flow]` 的 **直接子节点**（`flow.children`），不要扫整棵 document
- 自己的节点只挂在 `document.body`（回退切换器、摘要遮罩）
- 给已有行写属性（`setAttribute`），不要往行里塞新 DOM
- 折叠标题用行上的 `::before` / `::after`，不要 `position: fixed` 再 JS 追滚动

`MutationObserver` 只观察 `body` 和对话壳的 **`childList` + `subtree: false`**，用来发现会话壳出现/消失，摆一次回退切换器。绝不能跟 token 走。

## 4. 展示层怎么接到官方 DOM

只绑 DSH **稳定产品属性**，不绑 CSS modules 哈希类名（`Sxvs8a_body` 这类会随构建变）。

官方结构（简化）：

```
[data-conversation-scroll]
  [data-chat-flow]                    /* flex 列，默认 gap 16px */
    [data-chat-flow-kind="user"]
    [data-chat-flow-kind="assistant-step"]
      [data-variant="think"][data-state="running"|"ok"]
        [aria-expanded]               /* DisclosureRow */
      /* 随后是 Markdown：p / li / pre / ... */
    [data-chat-flow-kind="tool-call"]
      [data-tool="pwsh"|"glob"|...]
      [data-state="running"|"ok"|"error"]
    [data-chat-flow-kind="context"|"compaction"|"command"|"turn-tail"]
```

Think 和正文经常是 **同一条** `assistant-step` 里的兄弟，父级 markdown body 默认 `gap: 16px`。这就是 Think 和正文间距偏大的根因。普通模式用负 `margin-top` 抵掉：

- Think 收起 + 下一段：`-14px`（约剩 2px）
- Think 展开 + 下一段：`-8px`
- Think 独占一步、正文在下一步：flow `gap: 10px` 再 `-8px`

## 5. 本插件写入的属性

根：

| 属性 | 位置 | 含义 |
|---|---|---|
| `data-dsh-omode` | `html` / `body` | `verbose` / `normal` / `summary` |
| `data-dsh-om-running` | `html` | 摘要模式本轮仍在跑，用来藏过程、开遮罩 |

分组（普通 + 摘要展开后）：

| 属性 | 含义 |
|---|---|
| `data-dsh-om-gid` | 组 id（首行 `data-chat-call-id` 或 `data-chat-anchor-key`） |
| `data-dsh-om-grole` | `head` / `member` |
| `data-dsh-om-gopen` | `0` 收起 / `1` 展开 |
| `data-dsh-om-label` | 折叠文案，`::before { content: attr(...) }` |
| `data-dsh-om-gkind` | 左侧图标种类：`shell` `read` `file` `search` `web` `todo` `skill` `subagent` `context` `other` |
| `data-dsh-om-grun` | 组内有 running，标题扫光 |

摘要整轮胶囊：

| 属性 | 含义 |
|---|---|
| `data-dsh-om-tid` | 这一轮过程的 id |
| `data-dsh-om-trole` | `head` / `member` |
| `data-dsh-om-briefpack` | `1` = 已收成胶囊 |
| `data-dsh-om-recap` | 胶囊文案，例如「运行了 2 条命令，阅读了 3 个文件」 |

Think 预览（仅普通 + 正在跑 + 未展开）：

| 属性 | 含义 |
|---|---|
| `data-dsh-om-think` | 节流后的一行预览，`::before` 显示 |
| `data-dsh-om-inline-think` | 混合 `assistant-step` 内的 Think 所属组 id；组收起时只隐藏此子节点，不隐藏正文 |

写属性一律走 `setMark`：值没变就不写，减少 React 协调抖动。

## 6. 分组算法

`collectGroups()` 只扫 `flow.children`，普通模式按以下规则组织：

1. `tool-call` / `command` 根据工具类型进入探索、修改或协调阶段；同一正文区间内，同一语义阶段不限数量聚合，不按固定条数强拆。
2. 纯 Think 暂存并归入相邻过程组，不单独制造一条噪声行；没有相邻工具时才形成思考过程组。
3. 同时包含 Think 和正文的 `assistant-step`：Think 计入前一过程组，正文保持独立展示。
4. 任何可见 assistant 正文都是**硬分界**，立即结束当前组；正文后的工具必须新起一组，即使工具类型与正文前相同。
5. `context` / `compaction` 独立成组；user、system 等非过程行同样结束当前组。

探索阶段可混合命令、读取、搜索和浏览；修改阶段可连续聚合多次写入或编辑；语义族明显变化时仍拆成新组。组标题按 kind 分项汇总，例如「运行了 2 条命令，思考了 3 次，阅读了 2 个文件」。

混合 `assistant-step` 展开时，正文行的上边距临时从 `6px` 调为 `-6px`：结合 flow 的 `10px` gap，使上一工具到回挂 Think 的距离与组内其它过程行一致为 `4px`。回挂 Think 到正文单独保留约 `10px`，明确区分“组内过程”和“组后正文”；其它 Think 间距规则不受影响。

文案：

- 普通过程组用 `processTitle` 按 kind 分项计数并拼接（「运行了 2 条命令，思考了 3 次」）
- 摘要内的基础工具组：单一 kind 用 `groupTitle(kind, n)`，混合 kind 使用通用命令标题
- 摘要胶囊用 `recapTitle`：按 kind 计数后用顿号拼（「运行了 2 条命令，阅读了 3 个文件」），单条也带数字

`classifyTool(name)` 用工具名正则。注意顺序：`browse` 会先命中 `read`，再轮不到 `web`。

## 7. 折叠条外观（不要再改回 fixed）

标题写在 **head 行自己身上**：

- `::before`：文案；running 时扫光
- `::after`：左侧 14px mask 图标；`gopen=1` 时换成向下箭头

标题文案默认 `opacity: .72`，作为正文的次级信息；hover 提升到 `.88`，running 扫光提升到 `.9`。

图标是 data-URI SVG，通过 CSS 变量 `--dsh-om-ico-*` + `mask` 上色，跟 `currentColor`。不要往 React 行里插 `<svg>`。

收起：head `max-height: 24px`，子节点 `visibility: hidden`，member `display: none`。
展开：head `padding-top: 24px` 给标签留位，下面露出原生工具卡。点标签条（顶部 24px）才收起；点到原生 DisclosureRow 则交给官方展开命令详情。

**禁止**再用 `position: fixed` 的小标签 + `getBoundingClientRect` 追滚动。那样会：滚动滞后、标签滞留、展开 Think 后对不齐。

## 8. 摘要模式

运行中（`html[data-dsh-om-running]`）：

- CSS 藏起 tool / context / command / 纯 Think 步
- `body` 上一块 **fixed** 遮罩（不进 React 树）：呼吸圆点 + 扫光动词 + 详情 + 计时
- 文案优先 `session.getSnapshot().runningCalls`，没有详情再读 Think 一行预览
- 计时 1s `setInterval`，只在摘要 + 正在跑时开

结束后：

- `data-dsh-om-running` 立刻摘掉
- 遮罩短暂显示「已完成 · N 个步骤 · 用时」，约 4.2s 后淡出
- `canPack = process.length > 0 && !running`：整轮过程收成胶囊
- 胶囊点开后露出普通折叠条；再点胶囊标题条收起

历史上胶囊「消失」是因为 packed head 同时是 `grole=head`，一条 `content: none !important` 把 **同一个** `::before` 盖掉了，胶囊 `content: attr(data-dsh-om-recap)` 输给 `!important`。不要再对 `grole=head::before` 在 briefpack 下写 `content: none !important`。

## 9. 切换器

优先级：

1. slot `conversation.session.header.utilities`（`HeaderSwitch`，React）
2. slot `settings.general.item`（`SettingsRow`，三张竖卡）
3. DOM 回退：`body` 上 `position: fixed`，贴在 `[data-composer-card]` 上方；一旦 header 里出现官方 slot 切换器就永久隐藏

`react` / `@deepseek-ai/dsh-client-ui-primitives` 只当平台 seed，`tryRequire` 失败则只用 DOM 回退。不要 `require` 其它插件包的值（bundle purity）。

快捷键：`Alt+1/2/3`，不带 Ctrl/Meta/Shift。
持久化：`localStorage['dsh-view-modes']`。旧键 `dsh-output-mode` 仅在首次升级时作为迁移来源读取。

语言：注入 Harness 的 `locale` 服务，在 `dsh-view-modes` namespace 注册 `COPY.zh` / `COPY.en`。`locale.getSnapshot().active` 决定当前语言，`locale.subscribe()` 触发 React slot、DOM 回退切换器、过程分组与运行文案同步刷新；只有 locale 服务不可用时才回退 `document.lang / navigator.language`。

## 10. 热路径调度

```
sessions.list.subscribe  →  换当前 session 时改订
current session.subscribe →  queueRefresh()
                              └ rAF
                                 ├ refreshRun   摘要遮罩 / running 旗
                                 ├ syncGroups   写分组 + 胶囊属性
                                 └ syncThink    写 Think 一行预览
```

滚动 / resize / flow `ResizeObserver` **只**摆遮罩和回退切换器，不再摆折叠标签。

点击（capture）：

- Think 行 → `syncThink(true)`（展开后去掉预览伪元素）
- 胶囊 head → 切换 `recapOpen`
- 分组 head → 切换 `groupOpen`（已展开时只有点顶部 24px 才收）

## 11. 改哪里

| 想改 | 去哪 |
|---|---|
| 文案 / 中英 | `COPY.zh` / `COPY.en` |
| 三档含义、默认档 | `MODES` / `DEFAULT_MODE` / `LEGACY` |
| 工具分类 | `classifyTool` / `groupKindOf` |
| 折叠/胶囊句子 | `groupTitle` / `titleForKinds` / `recapTitle` |
| 间距、行高 | 样式数组里 `--dsh-om-row` 和 Think `margin-top` |
| 图标 | `ICO` + `--dsh-om-ico-*` + `[data-dsh-om-gkind]` |
| 摘要运行动画 | `.dsh-om-*` 和 `refreshRun` |
| 新官方 DOM | 只加稳定 `data-*` 选择器，不要哈希类名 |

语法检查：`npm run check`（`node --check` 两个入口）。

## 12. 已知坑

1. **跨盘 pnpm link** 会链坏。用同盘 junction。
2. **profile `cordis.patch.yml` 再 insert 一次** 会双注册。保持 `[]`。
3. **改 client 不重启** 可能仍跑旧 `?rev=`。
4. 对 packed head 的 `::before` 写 `content: none !important` 会吞掉胶囊。
5. `AssistantMarkdown` body `gap: 16px` 是 Think–正文空隙来源；改间距先动这条的抵消，不要先动 flow gap。
6. 普通模式展开命令详情靠 `:not([data-dsh-om-gopen="1"]):not(:has([aria-expanded="true"]))` 收高度。少了后半段，点不开原生详情。
7. 不要把混合 `assistant-step` 整行标成 `grole`；它的 Think 子节点使用 `data-dsh-om-inline-think` 回挂过程组，正文必须保持独立。
8. `querySelector('[data-state=running]')` 只允许打在 **已经拿到的那一行** 上，不要对 document 扫。
