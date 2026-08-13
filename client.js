// DshViewModes 的浏览器端 half（client bundle）。
//
// 手写 CJS + ModuleLoader 包装（同 omdsh-dev/dsh-annotation 模式，零构建
// 步骤）：展示层用 CSS 变量与稳定 data-* 选择器改造现有对话；切换器优先
// 走官方 slots（header.utilities + settings.general.item），失败则 DOM
// 回退。不依赖任何 @deepseek-ai 插件的值导入——react / primitives / slots
// 仅为平台 seed，require 失败时自动降级。
//
// 三档即可（第四档 basic 和两边都重叠，已去掉）：
//   verbose   详尽：原样保留全部工具调用、推理、统计
//   normal    普通：工具/思考压成一行，正文是主角
//   summary   摘要：只看进度与回答；运行中 Codex 式扫光 + 底遮罩
//
// 持久化：localStorage。快捷键 Alt+1/2/3。旧值 detailed/basic/brief 会迁移。
//
// 性能铁律：禁止在流式输出路径上对 document 做 subtree MutationObserver /
// querySelectorAll 全树扫描 / 往 React 树里 appendChild。展示全靠 CSS；
// 运行态只订阅 session 快照并 rAF 节流。违反这条会让页面 RESULT_CODE_HUNG。
window.__ModuleLoader__.load({
  // 必须与 package.json "name" 完全一致，否则 client-modules 报：
  // bundle loaded without registering "dsh-view-modes"
  id: 'dsh-view-modes',
  factory: (require) => {
    'use strict'
    var module = { exports: {} }
    var exports = module.exports

    var STORAGE_KEY = 'dsh-view-modes'
    var LEGACY_STORAGE_KEY = 'dsh-output-mode'
    var ATTR = 'data-dsh-omode'
    var MODES = ['verbose', 'normal', 'summary']
    var DEFAULT_MODE = 'normal'
    var LEGACY = { detailed: 'verbose', basic: 'summary', brief: 'summary' }
    var STYLE_ID = 'dsh-view-modes-style'
    var LOCALE_NS = 'dsh-view-modes'
    var localeService = null
    var localeTranslate = null

    function tryRequire(spec) {
      try { return require(spec) } catch (_) { return null }
    }

    var React = tryRequire('react')
    var primitives = tryRequire('@deepseek-ai/dsh-client-ui-primitives')

    function isZh() {
      if (localeService && typeof localeService.getSnapshot === 'function') {
        try { return localeService.getSnapshot().active === 'zh' } catch (_) { /* fallback */ }
      }
      var lang = (document.documentElement.lang || navigator.language || 'zh').toLowerCase()
      return lang.indexOf('zh') === 0
    }

    var COPY = {
      zh: {
        title: 'DshViewModes',
        hint: '选择对话展示的详细程度',
        settingsDesc: '详尽看全过程；普通按条折叠，可点开命令详情；摘要只留回答和一条过程胶囊。',
        verbose: '详尽',
        verboseFull: '详尽',
        verboseDesc: '完整工具调用、参数、结果与推理，适合排查。',
        normal: '普通',
        normalFull: '普通',
        normalDesc: '思考和工具合并为过程组，保留当前进度，点开可看详情。',
        summary: '摘要',
        summaryFull: '摘要',
        summaryDesc: '只看回答。过程收成回答上方一粒胶囊，点开再看步骤。',
        injectedContext: '注入了上下文',
        injectedContextN: '注入了 {n} 处上下文',
        thought: '思考',
        thoughtN: '思考了 {n} 次',
        retried: '重试了模型',
        processFold: '过程',
        processFoldN: '过程 · {n} 步',
        recapDone: '完成',
        recapSteps: '{n} 步',
        usedBrowser: '已使用浏览器运行了命令',
        ranCommands: '运行了命令',
        ranCommandsN: '运行了 {n} 条命令',
        editedFiles: '修改了文件',
        editedFilesN: '修改了 {n} 个文件',
        readFiles: '阅读了文件',
        readFilesN: '阅读了 {n} 个文件',
        searchedCode: '搜索了代码',
        searchedCodeN: '搜索了 {n} 次',
        browsedWeb: '浏览了网页',
        browsedWebN: '浏览了 {n} 次网页',
        usedTools: '调用了工具',
        usedToolsN: '调用了 {n} 个工具',
        updatedPlan: '更新了计划',
        usedSkill: '使用了技能',
        delegated: '委派了任务',
        thinkLabel: '思考',
        thinking: '正在思考',
        working: '正在执行',
        reading: '正在阅读',
        writing: '正在写入',
        editing: '正在编辑',
        searching: '正在搜索',
        runningCmd: '正在运行命令',
        browsing: '正在浏览网页',
        planning: '正在更新计划',
        delegating: '正在委派子任务',
        waiting: '等待你的确认',
        usingSkill: '正在使用技能',
        done: '已完成',
        stepOne: '1 个步骤',
        stepMany: '{n} 个步骤',
        shortcut: 'Alt+1 详尽 · Alt+2 普通 · Alt+3 摘要',
      },
      en: {
        title: 'DshViewModes',
        hint: 'How much of the run to show',
        settingsDesc: 'Verbose is the full trace. Normal folds tools in place and lets you open details. Summary keeps the answer and one process pill.',
        verbose: 'Verbose',
        verboseFull: 'Verbose',
        verboseDesc: 'Every tool call, argument, result, and thought.',
        normal: 'Normal',
        normalFull: 'Normal',
        normalDesc: 'Thoughts and tools are grouped with live progress. Open a fold for details.',
        summary: 'Summary',
        summaryFull: 'Summary',
        summaryDesc: 'Just the answer. A single pill above it holds the process.',
        injectedContext: 'Injected context',
        injectedContextN: 'Injected {n} context items',
        thought: 'Thought',
        thoughtN: 'Thought {n} times',
        retried: 'Retried the model',
        processFold: 'Process',
        processFoldN: 'Process · {n} steps',
        recapDone: 'Done',
        recapSteps: '{n} steps',
        usedBrowser: 'Ran a command in the browser',
        ranCommands: 'Ran commands',
        ranCommandsN: 'Ran {n} commands',
        editedFiles: 'Edited files',
        editedFilesN: 'Edited {n} files',
        readFiles: 'Read files',
        readFilesN: 'Read {n} files',
        searchedCode: 'Searched',
        searchedCodeN: 'Searched {n} times',
        browsedWeb: 'Browsed the web',
        browsedWebN: 'Browsed the web {n} times',
        usedTools: 'Used tools',
        usedToolsN: 'Used {n} tools',
        updatedPlan: 'Updated the plan',
        usedSkill: 'Used a skill',
        delegated: 'Delegated',
        thinkLabel: 'Thinking',
        thinking: 'Thinking',
        working: 'Working',
        reading: 'Reading',
        writing: 'Writing',
        editing: 'Editing',
        searching: 'Searching',
        runningCmd: 'Running a command',
        browsing: 'Browsing the web',
        planning: 'Updating the plan',
        delegating: 'Delegating',
        waiting: 'Waiting for you',
        usingSkill: 'Using a skill',
        done: 'Done',
        stepOne: '1 step',
        stepMany: '{n} steps',
        shortcut: 'Alt+1 Verbose · Alt+2 Normal · Alt+3 Summary',
      },
    }

    function t(key) {
      if (localeTranslate) return localeTranslate(key)
      var pack = isZh() ? COPY.zh : COPY.en
      return pack[key] || COPY.en[key] || key
    }

    function modeMeta(id) {
      return {
        verbose: { short: t('verbose'), full: t('verboseFull'), desc: t('verboseDesc') },
        normal: { short: t('normal'), full: t('normalFull'), desc: t('normalDesc') },
        summary: { short: t('summary'), full: t('summaryFull'), desc: t('summaryDesc') },
      }[id]
    }

    function isMode(value) {
      return MODES.indexOf(value) !== -1
    }

    function migrateMode(raw) {
      if (isMode(raw)) return raw
      if (raw && LEGACY[raw]) return LEGACY[raw]
      return DEFAULT_MODE
    }

    function readStored() {
      try {
        var raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw === null) raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
        var next = migrateMode(raw)
        if (next !== window.localStorage.getItem(STORAGE_KEY)) {
          try { window.localStorage.setItem(STORAGE_KEY, next) } catch (_) { /* */ }
        }
        return next
      } catch (_) { /* private mode */ }
      return DEFAULT_MODE
    }

    function writeStored(mode) {
      try { window.localStorage.setItem(STORAGE_KEY, mode) } catch (_) { /* ignore */ }
    }

    function maskUrl(inner) {
      return 'url("data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14">' + inner + '</svg>'
      ) + '")'
    }

    var ICO = {
      chevron: maskUrl('<path fill="black" d="M3.05 4.85 7 8.8l3.95-3.95.85.85L7 10.5 2.2 5.7z"/>'),
      shell: maskUrl('<rect x="1.45" y="2.45" width="11.1" height="9.1" rx="1.5" fill="none" stroke="black" stroke-width="1.2"/><path d="M3.85 5.45 5.75 7.05 3.85 8.65" fill="none" stroke="black" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.15 8.7h3.05" fill="none" stroke="black" stroke-width="1.2" stroke-linecap="round"/>'),
      read: maskUrl('<path fill="black" d="M3.05 1.55h5.15L10.95 4.3v8.15H3.05V1.55zm4.85.55v2.55h2.55"/><path fill="black" d="M4.7 7.05h4.6v1.05H4.7zm0 2.15h3.3v1.05H4.7z"/>'),
      file: maskUrl('<path fill="black" d="M8.55 1.6 11.4 4.45V12.4H2.6V1.6h5.95zm-.35.85H3.65v8.9h6.7V4.85H8.2V2.45z"/><path fill="black" d="M4.85 6.7h4.3v1H4.85zm0 2h3.2v1H4.85z"/>'),
      search: maskUrl('<circle cx="6.05" cy="6.05" r="3.35" fill="none" stroke="black" stroke-width="1.3"/><path d="M8.55 8.55 12 12" fill="none" stroke="black" stroke-width="1.45" stroke-linecap="round"/>'),
      web: maskUrl('<circle cx="7" cy="7" r="5.05" fill="none" stroke="black" stroke-width="1.2"/><ellipse cx="7" cy="7" rx="2.2" ry="5.05" fill="none" stroke="black" stroke-width="1.1"/><path d="M2.15 7h9.7M3.1 4.35h7.8M3.1 9.65h7.8" fill="none" stroke="black" stroke-width="1.05"/>'),
      todo: maskUrl('<path fill="black" d="M2.2 3.1h1.7v1.7H2.2zm3.1.3h6.3v1.1H5.3zM2.2 6.65h1.7v1.7H2.2zm3.1.3h6.3v1.1H5.3zM2.2 10.2h1.7v1.7H2.2zm3.1.3h6.3v1.1H5.3z"/>'),
      skill: maskUrl('<path fill="black" d="M7 1.4 8.15 5.1 11.9 6.25 8.15 7.4 7 11.1 5.85 7.4 2.1 6.25 5.85 5.1z"/>'),
      subagent: maskUrl('<circle cx="7" cy="3.15" r="1.3" fill="black"/><circle cx="3.55" cy="10.35" r="1.3" fill="black"/><circle cx="10.45" cy="10.35" r="1.3" fill="black"/><path d="M7 4.5v1.65M7 6.15 3.8 9.05M7 6.15 10.2 9.05" fill="none" stroke="black" stroke-width="1.15"/>'),
      context: maskUrl('<path fill="black" d="M6.25 1.55h1.5v5.15h2.2L7 9.75 4.05 6.7h2.2zM2.25 10.4h9.5v1.5H2.25z"/>'),
      other: maskUrl('<circle cx="7" cy="7" r="5.1" fill="none" stroke="black" stroke-width="1.2"/><path fill="black" d="M6.4 4.25h1.2v3.15H6.4zm0 3.85h1.2V9.5H6.4z"/>'),
      list: maskUrl('<path fill="black" d="M2.2 3.05h1.6v1.6H2.2zm2.85.25h6.75v1.1H5.05zM2.2 6.2h1.6v1.6H2.2zm2.85.25h6.75v1.1H5.05zM2.2 9.35h1.6v1.6H2.2zm2.85.25h6.75v1.1H5.05z"/>'),
    }

    // ============================== 样式 ==============================
    var existingStyle = document.getElementById(STYLE_ID)
    if (existingStyle) existingStyle.remove()
    {
      var style = document.createElement('style')
      style.id = STYLE_ID
      style.setAttribute('data-plugin', 'dsh-view-modes')
      style.textContent = [
        /* 根属性由 applyAttr 写入 html */
        'html[data-dsh-omode] { --dsh-om-ease: cubic-bezier(.22,.61,.36,1); --dsh-om-row: 24px;',
        '  --dsh-om-ico-chevron: ' + ICO.chevron + ';',
        '  --dsh-om-ico-shell: ' + ICO.shell + ';',
        '  --dsh-om-ico-read: ' + ICO.read + ';',
        '  --dsh-om-ico-file: ' + ICO.file + ';',
        '  --dsh-om-ico-search: ' + ICO.search + ';',
        '  --dsh-om-ico-web: ' + ICO.web + ';',
        '  --dsh-om-ico-todo: ' + ICO.todo + ';',
        '  --dsh-om-ico-skill: ' + ICO.skill + ';',
        '  --dsh-om-ico-subagent: ' + ICO.subagent + ';',
        '  --dsh-om-ico-context: ' + ICO.context + ';',
        '  --dsh-om-ico-other: ' + ICO.other + ';',
        '  --dsh-om-ico-list: ' + ICO.list + '; }',

        /* ---------- normal：思考 / 折叠条同一行高，过程条之间更紧 ---------- */
        'html[data-dsh-omode="normal"] [data-chat-flow] { gap: 10px !important; }',
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="tool-call"]:not([data-dsh-om-gopen="1"]):not(:has([aria-expanded="true"])) {',
        '  max-height: var(--dsh-om-row); overflow: hidden; opacity: .88; }',
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="tool-call"][data-dsh-om-gopen="1"],',
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="tool-call"]:has([aria-expanded="true"]) {',
        '  max-height: none !important; overflow: visible !important; opacity: 1; }',
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="tool-call"]:not([data-dsh-om-gopen="1"]) [data-subcalls] { display: none !important; }',
        'html[data-dsh-omode="normal"] [data-variant="think"]:not(:has([aria-expanded="true"])) {',
        '  max-height: var(--dsh-om-row); overflow: hidden; opacity: .78; }',
        'html[data-dsh-omode="normal"] [data-variant="think"]:has([aria-expanded="true"]) {',
        '  max-height: none; overflow: visible; opacity: 1; }',
        'html[data-dsh-omode="normal"] [data-variant="think"][data-state="running"]:not(:has([aria-expanded="true"])):not([data-dsh-om-gopen="1"] *) > * {',
        '  visibility: hidden; }',
        'html[data-dsh-omode="normal"] [data-dsh-om-gopen="1"] [data-variant="think"][data-state="running"] > *,',
        'html[data-dsh-omode="normal"] [data-variant="think"][data-state="running"][data-dsh-om-gopen="1"] > * {',
        '  visibility: visible !important; }',
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="assistant-step"]:has([data-variant="think"]):not(:has(p, li, pre, h1, h2, h3, table, img)):not(:has([aria-expanded="true"])) {',
        '  max-height: var(--dsh-om-row); overflow: hidden; }',
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="context"],',
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="compaction"] {',
        '  max-height: var(--dsh-om-row); overflow: hidden; opacity: .5; }',
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="tool-call"] + [data-chat-flow-kind="tool-call"],',
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="context"] + [data-chat-flow-kind="tool-call"],',
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="tool-call"] + [data-chat-flow-kind="context"],',
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="assistant-step"]:has([data-variant="think"]) + [data-chat-flow-kind="tool-call"],',
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="tool-call"] + [data-chat-flow-kind="assistant-step"]:has([data-variant="think"]),',
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="assistant-step"]:has([data-variant="think"]) + [data-chat-flow-kind="context"],',
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="context"] + [data-chat-flow-kind="assistant-step"]:has([data-variant="think"]),',
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="assistant-step"]:has([data-variant="think"]) + [data-chat-flow-kind="assistant-step"]:has([data-variant="think"]) {',
        '  margin-top: -6px; }',
        /* 同一条回复：Think 与正文默认隔 16px，收成贴着的一小段 */
        'html[data-dsh-omode="normal"] [data-variant="think"]:not(:has([aria-expanded="true"])) + * {',
        '  margin-top: -14px !important; }',
        'html[data-dsh-omode="normal"] [data-variant="think"]:has([aria-expanded="true"]) + * {',
        '  margin-top: -8px !important; }',
        /* 回挂过程组的 Think 展开后，正文前恢复清晰的段落边界 */
        'html[data-dsh-omode="normal"] [data-dsh-om-inline-think][data-dsh-om-gopen="1"] + * {',
        '  margin-top: -6px !important; }',
        'html[data-dsh-omode="normal"] [data-variant="think"] + * > :first-child { margin-top: 0 !important; }',
        /* Think 独占一步、正文在下一步：flow 10px gap 再收一点 */
        'html[data-dsh-omode="normal"] [data-chat-flow-kind="assistant-step"]:has([data-variant="think"]):not(:has(p, li, pre, h1, h2, h3, table, img)) + [data-chat-flow-kind="assistant-step"]:not(:has([data-variant="think"])) {',
        '  margin-top: -8px !important; }',
        '[data-dsh-om-grole="member"][data-dsh-om-gopen="0"] { display: none !important; }',
        '[data-dsh-om-grole="head"][data-dsh-om-gopen="0"] {',
        '  max-height: var(--dsh-om-row) !important; overflow: hidden !important; padding-top: 0 !important; opacity: 1; }',
        '[data-dsh-om-grole="head"][data-dsh-om-gopen="0"] > * { visibility: hidden; }',
        '[data-dsh-om-grole="head"][data-dsh-om-gopen="1"] {',
        '  max-height: none !important; overflow: visible !important; padding-top: var(--dsh-om-row); opacity: 1; }',
        '[data-dsh-om-grole="member"][data-dsh-om-gopen="1"] {',
        '  max-height: none !important; overflow: visible !important; opacity: 1; }',
        'html[data-dsh-omode="normal"] [data-dsh-om-inline-think][data-dsh-om-gopen="0"] { display: none !important; }',
        'html[data-dsh-omode="normal"] [data-dsh-om-inline-think][data-dsh-om-gopen="0"] + * { margin-top: 0 !important; }',
        'html[data-dsh-omode="normal"] [data-dsh-om-answer="1"] { margin-block: 6px !important; }',
        /* 展开后，回挂前组的 Think 与组内工具保持相同的 4px 节奏 */
        'html[data-dsh-omode="normal"] [data-dsh-om-answer="1"]:has([data-dsh-om-inline-think][data-dsh-om-gopen="1"]) {',
        '  margin-top: -6px !important; }',
        'html[data-dsh-omode="normal"] [data-dsh-om-gid] + [data-dsh-om-answer="1"],',
        'html[data-dsh-omode="normal"] [data-dsh-om-answer="1"] + [data-dsh-om-gid] { margin-top: 6px !important; }',

        /* ---------- summary：跑的时候藏过程；结束后留回答 + 顶部过程折页 ---------- */
        'html[data-dsh-omode="summary"] [data-chat-flow] { gap: 14px !important; }',
        'html[data-dsh-omode="summary"] [data-variant="think"],',
        'html[data-dsh-omode="summary"] [data-chat-flow-kind="assistant-step"]:has([data-variant="think"]):not(:has(p, li, pre, h1, h2, h3, table, img)) {',
        '  display: none !important; }',
        'html[data-dsh-omode="summary"] [data-dsh-om-briefpack="1"][data-dsh-om-trole="member"] { display: none !important; }',
        'html[data-dsh-omode="summary"] [data-dsh-om-briefpack="1"][data-dsh-om-trole="head"] {',
        '  max-height: 22px !important; overflow: hidden; padding-top: 0 !important; }',
        'html[data-dsh-omode="summary"] [data-dsh-om-briefpack="1"][data-dsh-om-trole="head"] > * { visibility: hidden !important; }',
        'html[data-dsh-omode="summary"] [data-dsh-om-trole="head"]:not([data-dsh-om-briefpack="1"]) {',
        '  padding-top: 26px; }',
        'html[data-dsh-omode="summary"] [data-chat-flow-kind="assistant-step"] {',
        '  font-size: 16.5px; line-height: 1.8; }',
        'html[data-dsh-omode="summary"] [data-chat-flow-kind="tool-call"] + [data-chat-flow-kind="tool-call"],',
        'html[data-dsh-omode="summary"] [data-chat-flow-kind="assistant-step"]:has([data-variant="think"]) + [data-chat-flow-kind="tool-call"],',
        'html[data-dsh-omode="summary"] [data-chat-flow-kind="tool-call"] + [data-chat-flow-kind="assistant-step"]:has([data-variant="think"]) {',
        '  margin-top: -6px; }',
        'html[data-dsh-omode="summary"] [data-chat-flow] > [role="status"] { display: none !important; }',
        'html[data-dsh-omode="summary"] [data-chat-flow-kind="assistant-step"] {',
        '  font-size: 16.5px; line-height: 1.75; }',
        'html[data-dsh-omode="summary"] [data-chat-flow-kind="turn-tail"] { opacity: .45; }',
        'html[data-dsh-omode="summary"][data-dsh-om-running] [data-chat-flow-kind="tool-call"],',
        'html[data-dsh-omode="summary"][data-dsh-om-running] [data-chat-flow-kind="context"],',
        'html[data-dsh-omode="summary"][data-dsh-om-running] [data-chat-flow-kind="command"],',
        'html[data-dsh-omode="summary"][data-dsh-om-running] [data-chat-flow-kind="compaction"],',
        'html[data-dsh-omode="summary"][data-dsh-om-running] [data-chat-flow-kind="model-retry"],',
        'html[data-dsh-omode="summary"][data-dsh-om-running] [data-chat-flow-kind="assistant-step"]:has([data-variant="think"]):not(:has(p, li, pre, h1, h2, h3, table, img)) {',
        '  display: none !important; }',
        'html[data-dsh-omode="summary"][data-dsh-om-running] [data-conversation-scroll] {',
        '  --dsh-om-veil: color-mix(in srgb, var(--dsw-alias-bg-base) 88%, transparent); }',

        /* ---------- 标题栏三段开关 ---------- */
        '[data-dsh-om-switch] { all: initial; display: inline-flex; align-items: center;',
        '  font-family: var(--dsw-font-family, system-ui); box-sizing: border-box; }',
        '[data-dsh-om-switch] * { box-sizing: border-box; }',
        '.dsh-om-seg { display: inline-flex; align-items: center; padding: 2px;',
        '  border-radius: 10px; border: 1px solid var(--dsw-alias-border-l2);',
        '  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 86%, transparent); }',
        '.dsh-om-opt { appearance: none; border: 0; background: transparent; cursor: pointer;',
        '  height: 26px; padding: 0 11px; border-radius: 8px;',
        '  color: var(--dsw-alias-label-tertiary); font: inherit; font-size: 12px;',
        '  line-height: 26px; letter-spacing: .01em;',
        '  transition: background .16s var(--dsh-om-ease), color .16s var(--dsh-om-ease), box-shadow .16s var(--dsh-om-ease); }',
        '.dsh-om-opt:hover { color: var(--dsw-alias-label-secondary);',
        '  background: var(--dsw-alias-interactive-bg-hover); }',
        '.dsh-om-opt[data-active] { color: var(--dsw-alias-label-primary); font-weight: 600;',
        '  background: var(--dsw-alias-bg-base);',
        '  box-shadow: 0 0 0 1px var(--dsw-alias-border-l2), var(--dsw-shadow-lv1, 0 1px 2px rgba(0,0,0,.08)); }',
        '.dsh-om-opt:focus-visible { outline: 1.5px solid var(--dsw-alias-button-info-fill, #4c9aff);',
        '  outline-offset: 1px; }',

        /* 设置页：三张竖卡 */
        '.dsh-om-settings { display: flex; flex-direction: column; gap: 10px; width: 100%; }',
        '.dsh-om-settings-title { font-size: 14px; line-height: 20px; font-weight: 500;',
        '  color: var(--dsw-alias-label-primary); }',
        '.dsh-om-settings-desc { margin-top: 4px; font-size: 12px; line-height: 18px;',
        '  color: var(--dsw-alias-label-tertiary); }',
        '.dsh-om-choices { display: flex; flex-direction: column; gap: 6px; }',
        '.dsh-om-choice { appearance: none; display: grid; grid-template-columns: 14px 1fr; gap: 8px 10px;',
        '  align-items: start; width: 100%; text-align: left; cursor: pointer;',
        '  border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px;',
        '  background: transparent; color: inherit; font: inherit; padding: 10px 12px; }',
        '.dsh-om-choice:hover { background: var(--dsw-alias-interactive-bg-hover); }',
        '.dsh-om-choice[data-active] { border-color: color-mix(in srgb, var(--dsw-alias-text-accent, #4c9aff) 55%, var(--dsw-alias-border-l2));',
        '  background: color-mix(in srgb, var(--dsw-alias-text-accent, #4c9aff) 8%, transparent); }',
        '.dsh-om-choice-dot { width: 14px; height: 14px; margin-top: 3px; border-radius: 14px;',
        '  border: 1.5px solid var(--dsw-alias-border-l2); box-sizing: border-box; }',
        '.dsh-om-choice[data-active] .dsh-om-choice-dot {',
        '  border-color: var(--dsw-alias-text-accent, #4c9aff);',
        '  box-shadow: inset 0 0 0 3.5px var(--dsw-alias-text-accent, #4c9aff); }',
        '.dsh-om-choice-name { font-size: 13px; font-weight: 600; line-height: 20px;',
        '  color: var(--dsw-alias-label-primary); }',
        '.dsh-om-choice-desc { grid-column: 2; font-size: 12px; line-height: 17px;',
        '  color: var(--dsw-alias-label-tertiary); }',
        '.dsh-om-settings-foot { font-size: 11px; color: var(--dsw-alias-label-caption, var(--dsw-alias-label-tertiary)); }',

        /* ---------- 折叠标题写在行上（::before 文案 + ::after 左侧图标） ---------- */
        '[data-dsh-om-grole="head"] { position: relative; cursor: pointer; }',
        '[data-dsh-om-grole="head"]::before { content: attr(data-dsh-om-label); position: absolute;',
        '  left: 0; right: 8px; top: 0; height: var(--dsh-om-row); padding-left: 20px;',
        '  font-size: 13px; line-height: var(--dsh-om-row); font-weight: 400;',
        '  color: var(--dsw-alias-label-primary); opacity: .72; overflow: hidden; text-overflow: ellipsis;',
        '  white-space: nowrap; pointer-events: none; z-index: 1; box-sizing: border-box;',
        '  transition: opacity .16s ease; }',
        '[data-dsh-om-grole="head"]:hover::before { opacity: .88; }',
        '[data-dsh-om-grole="head"][data-dsh-om-grun]::before {',
        '  background: linear-gradient(90deg, var(--dsw-alias-label-primary) 0%, var(--dsw-alias-label-primary) 36%, var(--dsw-static-deepseek-200, #cfe0ff) 50%, var(--dsw-alias-label-primary) 64%, var(--dsw-alias-label-primary) 100%);',
        '  background-size: 220% 100%; background-position: 100% 0; color: transparent;',
        '  -webkit-text-fill-color: transparent; -webkit-background-clip: text; background-clip: text;',
        '  opacity: .9; animation: 1.65s linear infinite dsh-om-shimmer; }',
        '[data-dsh-om-grole="head"][data-dsh-om-roll="a"]::before { animation: .28s var(--dsh-om-ease) dsh-om-roll-a; }',
        '[data-dsh-om-grole="head"][data-dsh-om-roll="b"]::before { animation: .28s var(--dsh-om-ease) dsh-om-roll-b; }',
        '[data-dsh-om-grole="head"][data-dsh-om-grun][data-dsh-om-roll="a"]::before {',
        '  animation: .28s var(--dsh-om-ease) dsh-om-roll-a, 1.65s linear .28s infinite dsh-om-shimmer; }',
        '[data-dsh-om-grole="head"][data-dsh-om-grun][data-dsh-om-roll="b"]::before {',
        '  animation: .28s var(--dsh-om-ease) dsh-om-roll-b, 1.65s linear .28s infinite dsh-om-shimmer; }',
        '[data-dsh-om-grole="head"]::after { content: ""; position: absolute; left: 0; top: 5px;',
        '  width: 14px; height: 14px; background: currentColor; opacity: .72;',
        '  pointer-events: none; z-index: 2;',
        '  -webkit-mask: var(--dsh-om-ico-shell) center / 14px 14px no-repeat;',
        '  mask: var(--dsh-om-ico-shell) center / 14px 14px no-repeat; }',
        '[data-dsh-om-grole="head"][data-dsh-om-gkind="read"]::after {',
        '  -webkit-mask-image: var(--dsh-om-ico-read); mask-image: var(--dsh-om-ico-read); }',
        '[data-dsh-om-grole="head"][data-dsh-om-gkind="file"]::after {',
        '  -webkit-mask-image: var(--dsh-om-ico-file); mask-image: var(--dsh-om-ico-file); }',
        '[data-dsh-om-grole="head"][data-dsh-om-gkind="search"]::after {',
        '  -webkit-mask-image: var(--dsh-om-ico-search); mask-image: var(--dsh-om-ico-search); }',
        '[data-dsh-om-grole="head"][data-dsh-om-gkind="web"]::after {',
        '  -webkit-mask-image: var(--dsh-om-ico-web); mask-image: var(--dsh-om-ico-web); }',
        '[data-dsh-om-grole="head"][data-dsh-om-gkind="todo"]::after {',
        '  -webkit-mask-image: var(--dsh-om-ico-todo); mask-image: var(--dsh-om-ico-todo); }',
        '[data-dsh-om-grole="head"][data-dsh-om-gkind="skill"]::after {',
        '  -webkit-mask-image: var(--dsh-om-ico-skill); mask-image: var(--dsh-om-ico-skill); }',
        '[data-dsh-om-grole="head"][data-dsh-om-gkind="subagent"]::after {',
        '  -webkit-mask-image: var(--dsh-om-ico-subagent); mask-image: var(--dsh-om-ico-subagent); }',
        '[data-dsh-om-grole="head"][data-dsh-om-gkind="context"]::after {',
        '  -webkit-mask-image: var(--dsh-om-ico-context); mask-image: var(--dsh-om-ico-context); }',
        '[data-dsh-om-grole="head"][data-dsh-om-gkind="other"]::after {',
        '  -webkit-mask-image: var(--dsh-om-ico-other); mask-image: var(--dsh-om-ico-other); }',
        '[data-dsh-om-grole="head"][data-dsh-om-gopen="1"]::after {',
        '  -webkit-mask-image: var(--dsh-om-ico-chevron); mask-image: var(--dsh-om-ico-chevron); opacity: .55; }',
        'html[data-dsh-omode="normal"] [data-variant="think"][data-state="running"]:not(:has([aria-expanded="true"]))::before {',
        '  content: attr(data-dsh-om-think); display: block; height: var(--dsh-om-row);',
        '  font-size: 13px; line-height: var(--dsh-om-row); color: var(--dsw-alias-label-tertiary);',
        '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
        'html[data-dsh-omode="summary"] [data-dsh-om-briefpack="1"][data-dsh-om-trole="head"] {',
        '  position: relative; cursor: pointer; }',
        'html[data-dsh-omode="summary"] [data-dsh-om-briefpack="1"][data-dsh-om-trole="head"]::before {',
        '  content: attr(data-dsh-om-recap); position: absolute; left: 0; top: 0;',
        '  display: block; width: max-content; max-width: 100%; height: 22px;',
        '  padding: 0 10px 0 28px; border-radius: 11px; box-sizing: border-box;',
        '  font-size: 12px; line-height: 22px; color: var(--dsw-alias-label-secondary);',
        '  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 92%, transparent);',
        '  box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l2); pointer-events: none;',
        '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
        '  -webkit-text-fill-color: var(--dsw-alias-label-secondary); animation: none; }',
        'html[data-dsh-omode="summary"] [data-dsh-om-briefpack="1"][data-dsh-om-trole="head"]::after {',
        '  content: ""; display: block; position: absolute; left: 8px; top: 4px;',
        '  width: 14px; height: 14px; background: currentColor; opacity: .55;',
        '  -webkit-mask: var(--dsh-om-ico-list) center / 14px 14px no-repeat;',
        '  mask: var(--dsh-om-ico-list) center / 14px 14px no-repeat; }',

        /* ---------- Codex 式运行遮罩 ---------- */
        '[data-dsh-om-overlay] { position: fixed; z-index: 9; pointer-events: none;',
        '  opacity: 0; transform: translateY(6px);',
        '  transition: opacity .28s var(--dsh-om-ease), transform .28s var(--dsh-om-ease); }',
        '[data-dsh-om-overlay][data-on] { opacity: 1; transform: none; }',
        '.dsh-om-veil { position: absolute; left: 0; right: 0; bottom: 0; height: 140px;',
        '  background: linear-gradient(180deg,',
        '    color-mix(in srgb, var(--dsw-alias-bg-base) 0%, transparent) 0%,',
        '    color-mix(in srgb, var(--dsw-alias-bg-base) 42%, transparent) 38%,',
        '    color-mix(in srgb, var(--dsw-alias-bg-base) 86%, transparent) 100%); }',
        '.dsh-om-stage { position: relative; display: flex; flex-direction: column; gap: 4px;',
        '  padding: 0 2px 2px; max-width: var(--dsh-chat-content-width, 748px); }',
        '.dsh-om-line { display: inline-flex; align-items: center; gap: 10px; min-height: 26px; }',
        '.dsh-om-orb { position: relative; width: 8px; height: 8px; border-radius: 8px; flex: none;',
        '  background: var(--dsw-static-deepseek-500, #4c9aff);',
        '  box-shadow: 0 0 0 0 color-mix(in srgb, var(--dsw-static-deepseek-500, #4c9aff) 55%, transparent);',
        '  animation: dsh-om-breathe 1.8s ease-in-out infinite; }',
        '.dsh-om-orb:after { content: ""; position: absolute; inset: -5px; border-radius: 16px;',
        '  border: 1px solid color-mix(in srgb, var(--dsw-static-deepseek-500, #4c9aff) 35%, transparent);',
        '  animation: dsh-om-ring 1.8s ease-out infinite; }',
        '.dsh-om-text { position: relative; overflow: hidden; font: var(--dsw-font-s-strong-14, 500 14px/22px system-ui); }',
        '.dsh-om-shimmer {',
        '  background: linear-gradient(90deg,',
        '    var(--dsw-static-deepseek-500, #4c6fff) 0%,',
        '    var(--dsw-static-deepseek-500, #4c6fff) 38%,',
        '    var(--dsw-static-deepseek-200, #cfe0ff) 50%,',
        '    var(--dsw-static-deepseek-500, #4c6fff) 62%,',
        '    var(--dsw-static-deepseek-500, #4c6fff) 100%);',
        '  background-size: 220% 100%; background-position: 100% 0;',
        '  color: transparent; -webkit-text-fill-color: transparent;',
        '  -webkit-background-clip: text; background-clip: text;',
        '  animation: dsh-om-shimmer 1.7s linear infinite; }',
        '.dsh-om-text:after { content: ""; position: absolute; inset: -4px -18px;',
        '  background: linear-gradient(90deg, transparent 0%,',
        '    color-mix(in srgb, #fff 22%, transparent) 50%, transparent 100%);',
        '  transform: translateX(-80%); animation: dsh-om-mask 2.4s ease-in-out infinite;',
        '  pointer-events: none; mix-blend-mode: overlay; }',
        '.dsh-om-meta { font: var(--dsw-font-xs-13, 13px/18px system-ui); font-variant-numeric: tabular-nums;',
        '  color: var(--dsw-alias-label-caption); }',
        '.dsh-om-sub { padding-left: 18px; font-size: 12px; line-height: 16px;',
        '  color: var(--dsw-alias-label-tertiary); letter-spacing: .01em;',
        '  max-width: 42em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
        '[data-dsh-om-overlay][data-done] .dsh-om-orb { animation: none; box-shadow: none;',
        '  background: var(--dsw-alias-state-success-primary, #3dbe7a); }',
        '[data-dsh-om-overlay][data-done] .dsh-om-orb:after { display: none; }',
        '[data-dsh-om-overlay][data-done] .dsh-om-shimmer {',
        '  background: none; color: var(--dsw-alias-label-secondary);',
        '  -webkit-text-fill-color: var(--dsw-alias-label-secondary); animation: none; }',
        '[data-dsh-om-overlay][data-done] .dsh-om-text:after { display: none; }',

        '@keyframes dsh-om-shimmer { to { background-position: 0 0; } }',
        '@keyframes dsh-om-roll-a { from { opacity: 0; transform: translateY(72%); } to { opacity: 1; transform: none; } }',
        '@keyframes dsh-om-roll-b { from { opacity: 0; transform: translateY(72%); } to { opacity: 1; transform: none; } }',
        '@keyframes dsh-om-mask { 0% { transform: translateX(-80%); } 100% { transform: translateX(80%); } }',
        '@keyframes dsh-om-breathe { 0%, 100% { transform: scale(1); opacity: .85; } 50% { transform: scale(1.15); opacity: 1; } }',
        '@keyframes dsh-om-ring { 0% { transform: scale(.6); opacity: .55; } 100% { transform: scale(1.35); opacity: 0; } }',
        '@media (prefers-reduced-motion: reduce) {',
        '  .dsh-om-shimmer, .dsh-om-text:after, .dsh-om-orb, .dsh-om-orb:after,',
        '  [data-dsh-om-grole="head"][data-dsh-om-grun]::before,',
        '  [data-dsh-om-grole="head"][data-dsh-om-roll]::before { animation: none !important; transform: none !important; }',
        '  [data-dsh-om-grole="head"][data-dsh-om-grun]::before {',
        '    background: none; color: inherit; -webkit-text-fill-color: inherit; }',
        '  .dsh-om-shimmer { background: none; color: var(--dsw-alias-label-primary); -webkit-text-fill-color: var(--dsw-alias-label-primary); }',
        '}',
      ].join('\n')
      document.head.appendChild(style)
    }

    // ============================== 模式 store ==============================
    var mode = readStored()
    var listeners = []
    var storeRevision = 0

    function subscribe(fn) {
      listeners.push(fn)
      return function () {
        listeners = listeners.filter(function (x) { return x !== fn })
      }
    }

    function getStoreSnapshot() { return mode + ':' + storeRevision }

    function publishStore() {
      storeRevision++
      for (var i = 0; i < listeners.length; i++) listeners[i]()
    }

    function applyAttr() {
      document.documentElement.setAttribute(ATTR, mode)
      if (document.body) document.body.setAttribute(ATTR, mode)
    }

    function setMode(next) {
      if (!isMode(next) || next === mode) return
      mode = next
      writeStored(mode)
      applyAttr()
      publishStore()
    }

    applyAttr()

    // ============================== 活动文案 ==============================
    function basename(path) {
      if (!path) return ''
      var s = String(path).replace(/\\/g, '/')
      var parts = s.split('/')
      return parts[parts.length - 1] || s
    }

    function parseArgs(raw) {
      if (!raw || typeof raw !== 'string') return null
      try {
        var v = JSON.parse(raw)
        return v && typeof v === 'object' ? v : null
      } catch (_) { return null }
    }

    function pickField(obj, keys) {
      if (!obj) return ''
      for (var i = 0; i < keys.length; i++) {
        var v = obj[keys[i]]
        if (typeof v === 'string' && v.trim() !== '') return v.trim()
      }
      return ''
    }

    function groupKindOf(name) {
      var k = classifyTool(name)
      if (k === 'write' || k === 'edit') return 'file'
      if (k === 'ask') return 'other'
      return k
    }

    function groupTitle(kind, n, alwaysCount) {
      var many = alwaysCount || n > 1
      var key = {
        shell: many ? 'ranCommandsN' : 'ranCommands',
        file: many ? 'editedFilesN' : 'editedFiles',
        read: many ? 'readFilesN' : 'readFiles',
        search: many ? 'searchedCodeN' : 'searchedCode',
        web: 'usedBrowser',
        todo: 'updatedPlan',
        skill: 'usedSkill',
        subagent: 'delegated',
        context: many ? 'injectedContextN' : 'injectedContext',
        think: many ? 'thoughtN' : 'thought',
        retry: 'retried',
        other: many ? 'usedToolsN' : 'usedTools',
      }[kind] || (many ? 'ranCommandsN' : 'ranCommands')
      return t(key).replace('{n}', String(n))
    }

    function titleForKinds(kinds, n) {
      var has = Object.create(null)
      var uniq = []
      for (var i = 0; i < kinds.length; i++) {
        var k = kinds[i]
        if (!has[k]) { has[k] = true; uniq.push(k) }
      }
      if (uniq.length === 1) return groupTitle(uniq[0], n)
      return n > 1 ? t('ranCommandsN').replace('{n}', String(n)) : t('ranCommands')
    }

    function processTitle(kinds) {
      var counts = Object.create(null)
      var order = []
      for (var i = 0; i < kinds.length; i++) {
        var k = kinds[i]
        if (!counts[k]) { counts[k] = 0; order.push(k) }
        counts[k]++
      }
      var parts = []
      for (i = 0; i < order.length; i++) {
        var kind = order[i]
        parts.push(kind === 'think'
          ? t('thoughtN').replace('{n}', String(counts[kind]))
          : groupTitle(kind, counts[kind], true))
      }
      return parts.join(isZh() ? '，' : ' · ') || t('processFold')
    }

    function processFamily(kind) {
      if (kind === 'file') return 'change'
      if (kind === 'todo' || kind === 'skill' || kind === 'subagent') return 'coordinate'
      if (kind === 'think') return ''
      return 'explore'
    }

    function primaryKind(kinds) {
      if (!kinds || !kinds.length) return 'other'
      var has = Object.create(null)
      var uniq = []
      for (var i = 0; i < kinds.length; i++) {
        if (!has[kinds[i]]) { has[kinds[i]] = true; uniq.push(kinds[i]) }
      }
      return uniq.length === 1 ? uniq[0] : 'shell'
    }

    function recapTitle(kinds) {
      var counts = Object.create(null)
      var order = []
      for (var i = 0; i < kinds.length; i++) {
        var k = kinds[i]
        if (!counts[k]) { counts[k] = 0; order.push(k) }
        counts[k]++
      }
      var parts = []
      for (var j = 0; j < order.length; j++) {
        parts.push(groupTitle(order[j], counts[order[j]], true))
      }
      return parts.join(isZh() ? '，' : ' · ') || t('processFold')
    }

    function classifyTool(name) {
      var n = String(name || '').toLowerCase()
      if (/browser|browse|web|fetch|http/.test(n)) return 'web'
      if (/read|cat|open_file|fs_read/.test(n)) return 'read'
      if (/write|create_file|fs_write/.test(n)) return 'write'
      if (/edit|str_replace|apply_patch|search_replace|patch/.test(n)) return 'edit'
      if (/grep|glob|search|find/.test(n)) return 'search'
      if (/bash|pwsh|shell|exec|terminal|command/.test(n)) return 'shell'
      if (/todo/.test(n)) return 'todo'
      if (/subagent|delegate|task/.test(n)) return 'subagent'
      if (/ask|question|user/.test(n)) return 'ask'
      if (/skill/.test(n)) return 'skill'
      return 'other'
    }

    function verbFor(kind) {
      switch (kind) {
        case 'read': return t('reading')
        case 'write': return t('writing')
        case 'edit': return t('editing')
        case 'search': return t('searching')
        case 'shell': return t('runningCmd')
        case 'web': return t('browsing')
        case 'todo': return t('planning')
        case 'subagent': return t('delegating')
        case 'ask': return t('waiting')
        case 'skill': return t('usingSkill')
        default: return t('working')
      }
    }

    function describeCall(call) {
      var name = call && (call.name || call.toolName) || ''
      var kind = classifyTool(name)
      var args = parseArgs(call && call.argsRaw)
      var path = pickField(args, ['path', 'file', 'file_path', 'filePath', 'target_file', 'filename'])
      var query = pickField(args, ['query', 'pattern', 'glob', 'url', 'command', 'cmd', 'skill', 'description', 'prompt'])
      var detail = ''
      if (path) detail = basename(path)
      else if (query) detail = query.length > 56 ? query.slice(0, 55) + '…' : query
      return { verb: verbFor(kind), detail: detail, kind: kind }
    }

    function currentBinding(sessions) {
      if (!sessions || !sessions.list) return null
      var id = sessions.list.getSnapshot().current
      if (id === undefined) return null
      try { return sessions.binding(id) || null } catch (_) { return null }
    }

    function currentSnap(sessions) {
      var b = currentBinding(sessions)
      if (b === null || !b.session || typeof b.session.getSnapshot !== 'function') return null
      try { return b.session.getSnapshot() } catch (_) { return null }
    }

    function formatElapsed(ms) {
      var s = Math.max(0, Math.floor(ms / 1000))
      if (s < 60) return '0:' + String(s).padStart(2, '0')
      var m = Math.floor(s / 60)
      return m + ':' + String(s % 60).padStart(2, '0')
    }

    function stepLabel(n) {
      if (n <= 1) return t('stepOne')
      return t('stepMany').replace('{n}', String(n))
    }

    // ============================== 切换器 UI ==============================
    function h(tag, attrs, children) {
      var el = document.createElement(tag)
      if (attrs) {
        Object.keys(attrs).forEach(function (k) {
          var v = attrs[k]
          if (v === undefined || v === null || v === false) return
          if (k === 'className') el.className = v
          else if (k === 'text') el.textContent = v
          else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v)
          else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d] })
          else el.setAttribute(k, v === true ? '' : String(v))
        })
      }
      ;(children || []).forEach(function (c) {
        if (c == null) return
        el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
      })
      return el
    }

    function buildSegmented(onPick, size) {
      var wrap = h('div', { className: 'dsh-om-seg', role: 'radiogroup', 'aria-label': t('title') })
      MODES.forEach(function (id) {
        var meta = modeMeta(id)
        var btn = h('button', {
          type: 'button',
          className: 'dsh-om-opt',
          role: 'radio',
          title: meta.full + ' — ' + meta.desc,
          'aria-label': meta.full,
          'data-mode': id,
        }, [size === 'full' ? meta.full : meta.short])
        if (id === mode) {
          btn.setAttribute('data-active', '')
          btn.setAttribute('aria-checked', 'true')
        } else {
          btn.setAttribute('aria-checked', 'false')
        }
        btn.addEventListener('click', function (e) {
          e.preventDefault()
          e.stopPropagation()
          onPick(id)
        })
        wrap.appendChild(btn)
      })
      return wrap
    }

    function syncSegmented(root) {
      if (!root) return
      var group = root.matches && root.matches('.dsh-om-seg') ? root : root.querySelector('.dsh-om-seg')
      if (group) group.setAttribute('aria-label', t('title'))
      var buttons = root.querySelectorAll('.dsh-om-opt')
      for (var i = 0; i < buttons.length; i++) {
        var id = buttons[i].getAttribute('data-mode')
        var meta = modeMeta(id)
        buttons[i].textContent = meta.short
        buttons[i].setAttribute('aria-label', meta.full)
        buttons[i].setAttribute('title', meta.full + ' — ' + meta.desc)
        if (id === mode) {
          buttons[i].setAttribute('data-active', '')
          buttons[i].setAttribute('aria-checked', 'true')
        } else {
          buttons[i].removeAttribute('data-active')
          buttons[i].setAttribute('aria-checked', 'false')
        }
      }
    }

    function HeaderSwitch() {
      React.useSyncExternalStore(subscribe, getStoreSnapshot, getStoreSnapshot)
      var current = mode
      var kids = MODES.map(function (id) {
        var meta = modeMeta(id)
        var btn = React.createElement('button', {
          key: id,
          type: 'button',
          className: 'dsh-om-opt',
          role: 'radio',
          'aria-checked': current === id,
          'aria-label': meta.full,
          title: meta.full + ' — ' + meta.desc,
          'data-mode': id,
          'data-active': current === id ? '' : undefined,
          onClick: function () { setMode(id) },
        }, meta.short)
        if (primitives && primitives.Tooltip) {
          return React.createElement(primitives.Tooltip, {
            key: id,
            label: meta.full + ' · ' + meta.desc,
            side: 'bottom',
            delayMs: 280,
            maxWidth: 240,
          }, btn)
        }
        return btn
      })
      return React.createElement('div', {
        'data-dsh-om-switch': '',
        className: 'dsh-om-seg',
        role: 'radiogroup',
        'aria-label': t('title'),
        title: t('shortcut'),
      }, kids)
    }

    function SettingsRow() {
      React.useSyncExternalStore(subscribe, getStoreSnapshot, getStoreSnapshot)
      var current = mode
      return React.createElement('div', { className: 'dsh-om-settings' },
        React.createElement('div', null,
          React.createElement('div', { className: 'dsh-om-settings-title' }, t('title')),
          React.createElement('div', { className: 'dsh-om-settings-desc' }, t('settingsDesc')),
        ),
        React.createElement('div', { className: 'dsh-om-choices', role: 'radiogroup', 'aria-label': t('title') },
          MODES.map(function (id) {
            var meta = modeMeta(id)
            return React.createElement('button', {
              key: id,
              type: 'button',
              className: 'dsh-om-choice',
              role: 'radio',
              'aria-checked': current === id,
              'data-active': current === id ? '' : undefined,
              onClick: function () { setMode(id) },
            },
              React.createElement('span', { className: 'dsh-om-choice-dot', 'aria-hidden': 'true' }),
              React.createElement('span', { className: 'dsh-om-choice-name' }, meta.full),
              React.createElement('span', { className: 'dsh-om-choice-desc' }, meta.desc),
            )
          }),
        ),
        React.createElement('div', { className: 'dsh-om-settings-foot' }, t('shortcut')),
      )
    }

    // ============================== 插件主体 ==============================
    function apply(ctx) {
      var sessions = ctx.sessions
      localeService = ctx.locale || (ctx.get && ctx.get('locale')) || null
      var unregisterLocale = null
      var localeUnsub = null
      if (localeService && typeof localeService.register === 'function') {
        try {
          unregisterLocale = localeService.register(LOCALE_NS, COPY)
          localeTranslate = localeService.bind(LOCALE_NS)
          if (typeof localeService.subscribe === 'function') {
            localeUnsub = localeService.subscribe(function () { publishStore() })
          }
        } catch (err) {
          console.warn('[dsh-view-modes] locale registration failed', err)
        }
      }
      applyAttr()

      var slotDisposers = []
      var slots = ctx.get && ctx.get('slots')
      if (slots && typeof slots.inject === 'function' && React) {
        try {
          slotDisposers.push(slots.inject('conversation.session.header.utilities', function () {
            return slots.register({
              name: 'conversation.session.header.utilities',
              id: 'dsh-view-modes',
              order: 10,
            }, HeaderSwitch)
          }))
        } catch (err) {
          console.warn('[dsh-view-modes] header slot failed, falling back to DOM', err)
        }
        try {
          slotDisposers.push(slots.inject('settings.general.item', function () {
            return slots.register({
              name: 'settings.general.item',
              id: 'dsh-view-modes',
              order: 26,
            }, SettingsRow)
          }))
        } catch (err) {
          console.warn('[dsh-view-modes] settings slot failed', err)
        }
      }

      // ---- DOM 回退切换器：永远挂在 body 上用 fixed 定位，绝不塞进 React 树 ----
      // 之前 append 进 header 会和每次 session 快照的协调打架，流式输出时死循环。
      var fallbackHost = h('div', { 'data-dsh-om-switch': '', 'data-dsh-om-fallback': '' })
      fallbackHost.appendChild(buildSegmented(setMode, 'short'))
      fallbackHost.style.cssText = 'position:fixed;z-index:1140;display:none;'
      document.body.appendChild(fallbackHost)
      var fallbackHidden = false
      var lastFallbackBox = ''

      function placeFallback() {
        if (fallbackHidden) return
        if (document.querySelector('header [data-dsh-om-switch]:not([data-dsh-om-fallback])')) {
          fallbackHidden = true
          fallbackHost.style.display = 'none'
          return
        }
        var card = document.querySelector('[data-composer-card]')
        if (!card) {
          if (fallbackHost.style.display !== 'none') fallbackHost.style.display = 'none'
          return
        }
        var r = card.getBoundingClientRect()
        var w = fallbackHost.offsetWidth || 148
        var left = Math.round(Math.max(8, r.right - w - 10))
        var top = Math.round(Math.max(8, r.top - 32))
        var box = left + ',' + top
        if (lastFallbackBox !== box || fallbackHost.style.display === 'none') {
          lastFallbackBox = box
          fallbackHost.style.left = left + 'px'
          fallbackHost.style.top = top + 'px'
          fallbackHost.style.display = 'inline-flex'
        }
      }

      // ---- 分组写在行上（data-dsh-om-label），滚动跟文档走，零 JS 追位置 ----
      var groupOpen = Object.create(null)
      var groupAnimating = Object.create(null)
      var groupMotionActive = 0
      var resettingNativeDetails = false
      var lastLiveThink = ''
      var lastLiveThinkAt = 0
      var recapOpen = Object.create(null)
      var lastGroupSig = ''
      var lastThinkText = ''
      var lastThinkAt = 0
      var lastThinkEl = null
      var scrollBound = null
      var flowBound = null
      var flowRO = null

      function setMark(el, name, value) {
        if (el.getAttribute(name) === value) return
        if (value === null || value === undefined) el.removeAttribute(name)
        else el.setAttribute(name, value)
      }

      function toolNameOf(row) {
        var node = row.querySelector('[data-tool]')
        return node ? (node.getAttribute('data-tool') || '') : ''
      }

      function callIdOf(row) {
        return row.getAttribute('data-chat-call-id')
          || row.getAttribute('data-chat-anchor-key')
          || ''
      }

      function rowBucket(el) {
        var fk = el.getAttribute('data-chat-flow-kind')
        if (fk === 'tool-call' || fk === 'command') return 'tool'
        if (fk === 'context' || fk === 'compaction') return 'context'
        if (mode === 'normal' && fk === 'assistant-step' && el.querySelector('[data-variant="think"]') && !isAnswerStep(el)) return 'think'
        return ''
      }

      function collectGroups() {
        var flow = document.querySelector('[data-chat-flow]')
        if (!flow) return []
        var kids = flow.children
        var groups = []
        var cur = null
        var pendingThinks = []
        function appendPending(group) {
          if (!group || !pendingThinks.length) return
          for (var p = 0; p < pendingThinks.length; p++) {
            group.rows.push(pendingThinks[p])
            group.kinds.push('think')
          }
          pendingThinks = []
        }
        function flushStandaloneThinks() {
          if (!pendingThinks.length) return
          var group = {
            bucket: 'explore',
            gid: callIdOf(pendingThinks[0]) || ('think-' + groups.length),
            rows: [],
            kinds: [],
            inlineThinks: [],
          }
          groups.push(group)
          appendPending(group)
          cur = group
        }
        for (var i = 0; i < kids.length; i++) {
          var el = kids[i]
          var bucket = rowBucket(el)
          if (!bucket) {
            if (cur) appendPending(cur)
            else flushStandaloneThinks()
            var answer = isAnswerStep(el)
            var inlineThink = answer ? el.querySelector('[data-variant="think"]') : null
            if (cur && inlineThink) {
              cur.kinds.push('think')
              cur.inlineThinks.push(inlineThink)
            }
            if (answer) setMark(el, 'data-dsh-om-answer', '1')
            else el.removeAttribute('data-dsh-om-answer')
            // Visible assistant text ends the current process phase. A mixed
            // step's Think stays with the preceding group, while its text
            // remains visible between that group and the next one.
            cur = null
            continue
          }
          el.removeAttribute('data-dsh-om-answer')
          var kind = bucket === 'context' ? 'context'
            : bucket === 'think' ? 'think'
              : groupKindOf(toolNameOf(el) || (el.getAttribute('data-chat-flow-kind') === 'command' ? 'bash' : ''))
          if (mode === 'normal' && bucket === 'think') {
            pendingThinks.push(el)
            continue
          }
          if (mode === 'normal' && bucket === 'context' && pendingThinks.length) {
            if (cur) appendPending(cur)
            else flushStandaloneThinks()
            cur = null
          }
          var normalProcess = mode === 'normal' && bucket !== 'context'
          var family = normalProcess ? processFamily(kind) : bucket
          if (!cur || cur.bucket !== family) {
            cur = {
              bucket: family,
              gid: pendingThinks.length ? (callIdOf(pendingThinks[0]) || ('g' + (i - pendingThinks.length))) : (callIdOf(el) || ('g' + i)),
              rows: [],
              kinds: [],
              inlineThinks: [],
            }
            groups.push(cur)
          }
          appendPending(cur)
          cur.rows.push(el)
          cur.kinds.push(kind)
        }
        if (cur) appendPending(cur)
        else flushStandaloneThinks()
        return groups
      }

      function currentActivityLabel() {
        var snap = currentSnap(sessions)
        if (snap && snap.runningCalls && snap.runningCalls.length) {
          var act = describeCall(snap.runningCalls[snap.runningCalls.length - 1])
          return act.verb + (act.detail ? ' ' + act.detail : '')
        }
        var snip = latestThinkSnippet()
        if (snip.text) {
          var now = Date.now()
          if (!lastLiveThink || now - lastLiveThinkAt >= 360) {
            lastLiveThink = snip.text
            lastLiveThinkAt = now
          }
          return t('thinking') + (isZh() ? '：' : ': ') + lastLiveThink
        }
        return t('thinking')
      }

      function clearRowMarks(el) {
        el.removeAttribute('data-dsh-om-gid')
        el.removeAttribute('data-dsh-om-grole')
        el.removeAttribute('data-dsh-om-gopen')
        el.removeAttribute('data-dsh-om-label')
        el.removeAttribute('data-dsh-om-base')
        el.removeAttribute('data-dsh-om-roll')
        el.removeAttribute('data-dsh-om-gkind')
        el.removeAttribute('data-dsh-om-grun')
        el.removeAttribute('data-dsh-om-briefpack')
        el.removeAttribute('data-dsh-om-trole')
        el.removeAttribute('data-dsh-om-recap')
        el.removeAttribute('data-dsh-om-tid')
        el.removeAttribute('data-dsh-om-think')
        el.removeAttribute('data-dsh-om-answer')
        el.removeAttribute('data-dsh-om-inline-think')
      }

      function clearGroups() {
        lastGroupSig = ''
        var marked = document.querySelectorAll('[data-dsh-om-gid], [data-dsh-om-briefpack], [data-dsh-om-trole], [data-dsh-om-think], [data-dsh-om-inline-think]')
        for (var i = 0; i < marked.length; i++) clearRowMarks(marked[i])
      }

      function isAnswerStep(el) {
        if (el.getAttribute('data-chat-flow-kind') !== 'assistant-step') return false
        var think = el.querySelector('[data-variant="think"]')
        var blocks = el.querySelectorAll('p, li, pre, h1, h2, h3, table, img')
        if (!think) return blocks.length > 0
        for (var i = 0; i < blocks.length; i++) {
          if (!think.contains(blocks[i])) return true
        }
        return false
      }

      function collectSummaryTurns() {
        var flow = document.querySelector('[data-chat-flow]')
        if (!flow) return []
        var kids = flow.children
        var turns = []
        var cur = { process: [], kinds: [], running: false, hasAnswer: false, tid: '' }
        function flush() {
          if (cur.process.length || cur.hasAnswer) turns.push(cur)
          cur = { process: [], kinds: [], running: false, hasAnswer: false, tid: '' }
        }
        for (var i = 0; i < kids.length; i++) {
          var el = kids[i]
          var fk = el.getAttribute('data-chat-flow-kind')
          if (fk === 'user' || fk === 'input-message' || fk === 'steering') { flush(); continue }
          var bucket = rowBucket(el)
          if (bucket) {
            if (!cur.tid) cur.tid = callIdOf(el) || ('t' + i)
            cur.process.push(el)
            cur.kinds.push(bucket === 'context' ? 'context' : groupKindOf(toolNameOf(el) || 'bash'))
            if (el.querySelector('[data-state="running"]')) cur.running = true
            continue
          }
          if (isAnswerStep(el)) cur.hasAnswer = true
        }
        flush()
        return turns
      }

      function markGroup(grp, liveGroup) {
        var open = groupOpen[grp.gid] ? '1' : '0'
        var rows = grp.rows
        var running = false
        for (var r = 0; r < rows.length; r++) {
          if (rows[r].matches('[data-state="running"]') || rows[r].querySelector('[data-state="running"]')) { running = true; break }
        }
        running = !!liveGroup && (running || grp.kinds.indexOf('think') >= 0)
        var baseLabel = mode === 'normal' && grp.bucket !== 'context'
          ? processTitle(grp.kinds)
          : titleForKinds(grp.kinds, rows.length)
        var label = baseLabel
        if (mode === 'normal' && running && grp.bucket !== 'context') {
          label += (isZh() ? '，' : ' · ') + currentActivityLabel()
        }
        for (r = 0; r < rows.length; r++) {
          setMark(rows[r], 'data-dsh-om-gid', grp.gid)
          setMark(rows[r], 'data-dsh-om-grole', r === 0 ? 'head' : 'member')
          setMark(rows[r], 'data-dsh-om-gopen', open)
          if (r === 0) {
            var oldBase = rows[r].getAttribute('data-dsh-om-base')
            setMark(rows[r], 'data-dsh-om-label', label)
            setMark(rows[r], 'data-dsh-om-base', baseLabel)
            if (oldBase && oldBase !== baseLabel) {
              setMark(rows[r], 'data-dsh-om-roll', rows[r].getAttribute('data-dsh-om-roll') === 'a' ? 'b' : 'a')
            }
            setMark(rows[r], 'data-dsh-om-gkind', primaryKind(grp.kinds))
            if (running) setMark(rows[r], 'data-dsh-om-grun', '')
            else rows[r].removeAttribute('data-dsh-om-grun')
          } else {
            rows[r].removeAttribute('data-dsh-om-label')
            rows[r].removeAttribute('data-dsh-om-base')
            rows[r].removeAttribute('data-dsh-om-roll')
            rows[r].removeAttribute('data-dsh-om-gkind')
            rows[r].removeAttribute('data-dsh-om-grun')
          }
        }
        var inlineThinks = grp.inlineThinks || []
        for (r = 0; r < inlineThinks.length; r++) {
          setMark(inlineThinks[r], 'data-dsh-om-inline-think', grp.gid)
          setMark(inlineThinks[r], 'data-dsh-om-gopen', open)
        }
      }

      function clearTurnMarks(el) {
        el.removeAttribute('data-dsh-om-briefpack')
        el.removeAttribute('data-dsh-om-trole')
        el.removeAttribute('data-dsh-om-recap')
        el.removeAttribute('data-dsh-om-tid')
      }

      function groupRows(gid) {
        var marked = document.querySelectorAll('[data-dsh-om-gid]')
        var rows = []
        for (var i = 0; i < marked.length; i++) {
          if (marked[i].getAttribute('data-dsh-om-gid') === gid) rows.push(marked[i])
        }
        return rows
      }

      function groupInlineThinks(gid) {
        var marked = document.querySelectorAll('[data-dsh-om-inline-think]')
        var thinks = []
        for (var i = 0; i < marked.length; i++) {
          if (marked[i].getAttribute('data-dsh-om-inline-think') === gid) thinks.push(marked[i])
        }
        return thinks
      }

      function reducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      }

      function collapseNativeDetails(rows) {
        var buttons = []
        for (var i = 0; i < rows.length; i++) {
          var expanded = rows[i].querySelectorAll('[aria-expanded="true"]')
          for (var j = 0; j < expanded.length; j++) buttons.push(expanded[j])
        }
        if (!buttons.length) return
        resettingNativeDetails = true
        for (i = 0; i < buttons.length; i++) {
          try { buttons[i].click() } catch (_) { /* detached during stream */ }
        }
        requestAnimationFrame(function () { resettingNativeDetails = false })
      }

      function animateGroup(gid, opening) {
        if (groupAnimating[gid]) return
        if (reducedMotion()) {
          groupOpen[gid] = opening
          syncGroups(true)
          return
        }

        var rows = groupRows(gid)
        if (!rows.length) return
        var inlineThinks = groupInlineThinks(gid)
        var head = rows[0]
        var flow = head.parentElement
        if (!flow) return

        var duration = opening ? 225 : 175
        var fadeDuration = opening ? 165 : 45
        var flowKids = Array.prototype.slice.call(flow.children)
        var headIndex = flowKids.indexOf(head)
        var scrollHost = document.querySelector('[data-conversation-scroll]')
        var viewRect = scrollHost ? scrollHost.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
        var before = new Map()
        var after = new Map()
        var affected = []
        var headContent = Array.prototype.slice.call(head.children)

        function visibleRects(store) {
          for (var i = headIndex; i < flowKids.length; i++) {
            var el = flowKids[i]
            var rect = el.getBoundingClientRect()
            if (rect.height > 0 && rect.bottom >= viewRect.top - 48 && rect.top <= viewRect.bottom + 48) {
              store.set(el, rect.top)
            }
          }
        }

        function setRowsOpen(open) {
          var value = open ? '1' : '0'
          groupOpen[gid] = open
          for (var i = 0; i < rows.length; i++) setMark(rows[i], 'data-dsh-om-gopen', value)
          for (i = 0; i < inlineThinks.length; i++) setMark(inlineThinks[i], 'data-dsh-om-gopen', value)
        }

        function setMotion(el, transition, transform, opacity) {
          el.style.transition = transition
          el.style.transform = transform
          if (opacity !== null) el.style.opacity = opacity
          el.style.willChange = 'transform, opacity'
          affected.push(el)
        }

        function clearMotion() {
          for (var i = 0; i < affected.length; i++) {
            affected[i].style.removeProperty('transition')
            affected[i].style.removeProperty('transform')
            affected[i].style.removeProperty('opacity')
            affected[i].style.removeProperty('visibility')
            affected[i].style.removeProperty('will-change')
          }
          groupMotionActive = Math.max(0, groupMotionActive - 1)
          delete groupAnimating[gid]
          onPlaceOnly()
        }

        groupAnimating[gid] = true
        groupMotionActive++
        visibleRects(before)

        if (opening) {
          setRowsOpen(true)
          visibleRects(after)
        } else {
          setRowsOpen(false)
          visibleRects(after)
          setRowsOpen(true)
        }

        // Move every later flow row as one surface. This keeps the transcript
        // visually anchored without animating layout on every frame.
        for (var i = headIndex + 1; i < flowKids.length; i++) {
          var follower = flowKids[i]
          if (rows.indexOf(follower) >= 0) continue
          var openTop = before.get(follower)
          var closedTop = after.get(follower)
          if (openTop === undefined || closedTop === undefined) continue
          var shift = opening ? openTop - closedTop : closedTop - openTop
          if (Math.abs(shift) < .5) continue
          setMotion(follower, 'none', opening ? 'translate3d(0,' + shift + 'px,0)' : 'none', null)
        }

        // The first command lives inside the head row. Animate its real content
        // with the member rows so all commands share exactly one timeline.
        for (i = 0; i < headContent.length; i++) {
          setMotion(headContent[i], 'none', opening ? 'translate3d(0,-4px,0)' : 'none', opening ? '0' : '1')
        }
        for (i = 1; i < rows.length; i++) {
          setMotion(rows[i], 'none', opening ? 'translate3d(0,-4px,0)' : 'none', opening ? '0' : '1')
        }
        for (i = 0; i < inlineThinks.length; i++) {
          setMotion(inlineThinks[i], 'none', opening ? 'translate3d(0,-4px,0)' : 'none', opening ? '0' : '1')
        }

        // Commit the starting frame once, then animate only compositor props.
        head.getBoundingClientRect()
        requestAnimationFrame(function () {
          var motion = 'transform ' + duration + 'ms cubic-bezier(.22,.61,.36,1)'
          var reveal = motion + ', opacity ' + fadeDuration + 'ms ease-out'
          for (var i = 0; i < affected.length; i++) {
            affected[i].style.transition = affected[i].style.opacity ? reveal : motion
            affected[i].style.transform = opening ? 'none' : affected[i].style.transform
          }
          for (i = 0; i < headContent.length; i++) {
            headContent[i].style.transform = opening ? 'none' : 'translate3d(0,-4px,0)'
            headContent[i].style.opacity = opening ? '1' : '0'
          }
          for (i = 1; i < rows.length; i++) {
            rows[i].style.transform = opening ? 'none' : 'translate3d(0,-4px,0)'
            rows[i].style.opacity = opening ? '1' : '0'
          }
          for (i = 0; i < inlineThinks.length; i++) {
            inlineThinks[i].style.transform = opening ? 'none' : 'translate3d(0,-4px,0)'
            inlineThinks[i].style.opacity = opening ? '1' : '0'
          }
          if (!opening) {
            for (i = headIndex + 1; i < flowKids.length; i++) {
              var later = flowKids[i]
              if (rows.indexOf(later) >= 0 || !before.has(later) || !after.has(later)) continue
              later.style.transform = 'translate3d(0,' + (after.get(later) - before.get(later)) + 'px,0)'
            }
          }
        })

        if (!opening) {
          setTimeout(function () {
            for (var i = 0; i < headContent.length; i++) headContent[i].style.visibility = 'hidden'
            for (i = 1; i < rows.length; i++) rows[i].style.visibility = 'hidden'
            for (i = 0; i < inlineThinks.length; i++) inlineThinks[i].style.visibility = 'hidden'
          }, fadeDuration + 8)
        }

        setTimeout(function () {
          if (!opening) {
            // Switch to the closed layout and clear the matching FLIP transform
            // in the same task, so the final frame cannot jump.
            setRowsOpen(false)
            collapseNativeDetails(rows)
          }
          clearMotion()
        }, duration + 34)
      }

      function syncGroups(force) {
        if (mode === 'verbose') {
          if (lastGroupSig !== '') clearGroups()
          return
        }
        var groups = collectGroups()
        var liveSnap = currentSnap(sessions)
        var liveList = sessions && sessions.list ? sessions.list.getSnapshot() : null
        var liveSummary = liveList && liveList.current && liveList.byId ? liveList.byId[liveList.current] : null
        var normalRunning = mode === 'normal' && (!!(liveSnap && liveSnap.running) || !!(liveSummary && liveSummary.running))
        var sigParts = [mode]
        var keepG = Object.create(null)
        for (var g = 0; g < groups.length; g++) {
          sigParts.push(groups[g].gid + ':' + groups[g].kinds.join(',') + ':' + groups[g].rows.length)
        }
        var turns = mode === 'summary' ? collectSummaryTurns() : []
        for (var ti = 0; ti < turns.length; ti++) {
          sigParts.push('t' + turns[ti].tid + ':' + turns[ti].process.length + ':' + (turns[ti].hasAnswer ? 'a' : '') + (turns[ti].running ? 'r' : ''))
        }
        var sig = sigParts.join('|')
        if (sig !== lastGroupSig || force) {
          lastGroupSig = sig
          var staleInline = document.querySelectorAll('[data-dsh-om-inline-think]')
          for (var si = 0; si < staleInline.length; si++) {
            var stillUsed = false
            for (var gi = 0; gi < groups.length && !stillUsed; gi++) {
              stillUsed = (groups[gi].inlineThinks || []).indexOf(staleInline[si]) >= 0
            }
            if (!stillUsed) {
              staleInline[si].removeAttribute('data-dsh-om-inline-think')
              staleInline[si].removeAttribute('data-dsh-om-gopen')
            }
          }
          for (g = 0; g < groups.length; g++) {
            keepG[groups[g].gid] = true
            markGroup(groups[g], normalRunning && g === groups.length - 1)
          }
          var stale = document.querySelectorAll('[data-dsh-om-gid]')
          for (var s = 0; s < stale.length; s++) {
            var id = stale[s].getAttribute('data-dsh-om-gid')
            if (!keepG[id]) clearRowMarks(stale[s])
          }
        } else {
          for (g = 0; g < groups.length; g++) markGroup(groups[g], normalRunning && g === groups.length - 1)
        }

        if (mode === 'summary') {
          var keepT = Object.create(null)
          for (ti = 0; ti < turns.length; ti++) {
            var turn = turns[ti]
            // DOM tool state can remain "running" after the session has settled.
            // The session snapshot is authoritative so stale row state cannot keep
            // every historical process row expanded in Summary mode.
            var turnRunning = turn.running && lastRunningFlag
            var canPack = turn.process.length > 0 && !turnRunning
            if (turnRunning) recapOpen[turn.tid] = false
            var packed = canPack && !recapOpen[turn.tid]
            keepT[turn.tid] = true
            var recap = recapTitle(turn.kinds)
            for (var p = 0; p < turn.process.length; p++) {
              var pel = turn.process[p]
              setMark(pel, 'data-dsh-om-tid', turn.tid)
              setMark(pel, 'data-dsh-om-trole', p === 0 ? 'head' : 'member')
              if (packed) {
                setMark(pel, 'data-dsh-om-briefpack', '1')
                if (p === 0) setMark(pel, 'data-dsh-om-recap', recap)
                else pel.removeAttribute('data-dsh-om-recap')
              } else {
                pel.removeAttribute('data-dsh-om-briefpack')
                pel.removeAttribute('data-dsh-om-recap')
              }
            }
          }
          var leftover = document.querySelectorAll('[data-dsh-om-tid], [data-dsh-om-briefpack], [data-dsh-om-trole]')
          for (var li = 0; li < leftover.length; li++) {
            var tid = leftover[li].getAttribute('data-dsh-om-tid')
            if (!tid || !keepT[tid]) clearTurnMarks(leftover[li])
          }
        } else {
          var extra = document.querySelectorAll('[data-dsh-om-briefpack], [data-dsh-om-trole], [data-dsh-om-recap], [data-dsh-om-tid]')
          for (var ei = 0; ei < extra.length; ei++) clearTurnMarks(extra[ei])
        }
      }

      function thinkExpanded(el) {
        return !!(el && el.querySelector('[aria-expanded="true"]'))
      }

      function latestThinkSnippet() {
        var running = document.querySelectorAll('[data-variant="think"][data-state="running"]')
        var row = running.length ? running[running.length - 1] : null
        if (!row || thinkExpanded(row)) return { el: null, text: '' }
        var raw = (row.textContent || '').replace(/^\s*Think\s*/i, '').trim()
        var lines = raw.split(/\n+/)
        var line = ''
        for (var i = lines.length - 1; i >= 0; i--) {
          var cand = lines[i].replace(/\s+/g, ' ').trim()
          if (cand.length >= 8) { line = cand; break }
        }
        if (!line) line = raw.replace(/\s+/g, ' ')
        if (line.length > 88) line = line.slice(0, 87) + '…'
        return { el: row, text: line }
      }

      function hideThink() {
        if (lastThinkEl) {
          lastThinkEl.removeAttribute('data-dsh-om-think')
          lastThinkEl = null
        }
      }

      function syncThink(force) {
        if (mode !== 'normal') {
          hideThink()
          lastThinkText = ''
          return
        }
        var snip = latestThinkSnippet()
        if (!snip.el || !snip.text) {
          hideThink()
          lastThinkText = ''
          return
        }
        var now = Date.now()
        if (force || snip.text === lastThinkText || now - lastThinkAt >= 480) {
          if (snip.text !== lastThinkText) {
            lastThinkText = snip.text
            lastThinkAt = now
          }
        }
        var text = lastThinkText || snip.text
        if (lastThinkEl && lastThinkEl !== snip.el) lastThinkEl.removeAttribute('data-dsh-om-think')
        lastThinkEl = snip.el
        setMark(snip.el, 'data-dsh-om-think', text)
      }

      // ---- 摘要模式运行遮罩（只读 session 快照，不扫 DOM 树） ----
      var overlay = h('div', { 'data-dsh-om-overlay': '', 'aria-live': 'polite', role: 'status' })
      var veil = h('div', { className: 'dsh-om-veil' })
      var stage = h('div', { className: 'dsh-om-stage' })
      var line = h('div', { className: 'dsh-om-line' })
      var orb = h('span', { className: 'dsh-om-orb', 'aria-hidden': 'true' })
      var textWrap = h('span', { className: 'dsh-om-text' })
      var shimmer = h('span', { className: 'dsh-om-shimmer', text: t('thinking') })
      var meta = h('span', { className: 'dsh-om-meta' })
      var sub = h('div', { className: 'dsh-om-sub' })
      textWrap.appendChild(shimmer)
      line.appendChild(orb)
      line.appendChild(textWrap)
      line.appendChild(meta)
      stage.appendChild(line)
      stage.appendChild(sub)
      overlay.appendChild(veil)
      overlay.appendChild(stage)
      document.body.appendChild(overlay)

      var runStartedAt = 0
      var lastToolCount = 0
      var hideTimer = null
      var clockTimer = null
      var overlayOn = false
      var lastPhrase = ''
      var lastDetail = ''
      var lastMeta = ''
      var lastDone = false
      var lastOverlayBox = ''
      var lastRunningFlag = false
      var refreshQueued = false

      function setRunningFlag(on) {
        if (on === lastRunningFlag) return
        lastRunningFlag = on
        if (on) document.documentElement.setAttribute('data-dsh-om-running', '')
        else document.documentElement.removeAttribute('data-dsh-om-running')
      }

      function placeOverlay() {
        if (!overlayOn) return
        var flow = document.querySelector('[data-chat-flow]')
        var scroll = document.querySelector('[data-conversation-scroll]')
        var seat = document.querySelector('[data-composer-seat]')
        if (flow === null || scroll === null) return
        var flowRect = flow.getBoundingClientRect()
        var scrollRect = scroll.getBoundingClientRect()
        var seatTop = seat ? seat.getBoundingClientRect().top : window.innerHeight
        var width = Math.min(flowRect.width, window.innerWidth - 24)
        var left = Math.round(flowRect.left)
        var bottomLimit = Math.min(seatTop - 12, scrollRect.bottom - 12)
        var top = Math.round(Math.max(scrollRect.top + 12, bottomLimit - 72))
        var height = Math.round(Math.max(64, bottomLimit - top + 8))
        var box = left + ',' + top + ',' + Math.round(width) + ',' + height
        if (box === lastOverlayBox) return
        lastOverlayBox = box
        overlay.style.left = left + 'px'
        overlay.style.top = top + 'px'
        overlay.style.width = Math.round(width) + 'px'
        overlay.style.height = height + 'px'
        veil.style.height = height + 'px'
      }

      function showOverlay(phrase, detail, elapsed, steps, done) {
        if (phrase && phrase !== lastPhrase) {
          shimmer.textContent = phrase
          lastPhrase = phrase
        }
        if (detail !== lastDetail) {
          lastDetail = detail
          sub.textContent = detail || ''
          sub.style.display = detail ? '' : 'none'
        }
        var bits = []
        if (elapsed) bits.push(elapsed)
        if (steps) bits.push(steps)
        var metaText = bits.join(' · ')
        if (metaText !== lastMeta) {
          lastMeta = metaText
          meta.textContent = metaText
        }
        if (done !== lastDone) {
          lastDone = done
          if (done) overlay.setAttribute('data-done', '')
          else overlay.removeAttribute('data-done')
        }
        if (!overlayOn) {
          overlayOn = true
          overlay.setAttribute('data-on', '')
        }
        placeOverlay()
      }

      function hideOverlay() {
        if (!overlayOn && !lastDone && !lastRunningFlag) return
        overlayOn = false
        lastDone = false
        lastOverlayBox = ''
        overlay.removeAttribute('data-on')
        overlay.removeAttribute('data-done')
        setRunningFlag(false)
      }

      function activityNow(snap) {
        if (snap && snap.runningCalls && snap.runningCalls.length > 0) {
          return describeCall(snap.runningCalls[snap.runningCalls.length - 1])
        }
        return { verb: t('thinking'), detail: '', kind: 'think' }
      }

      function stopClock() {
        if (clockTimer !== null) {
          clearInterval(clockTimer)
          clockTimer = null
        }
      }

      function startClock() {
        if (clockTimer !== null) return
        clockTimer = setInterval(function () {
          if (mode === 'summary' && runStartedAt > 0) refreshRun(true)
        }, 1000)
      }

      function refreshRun(fromClock) {
        if (mode !== 'summary') {
          stopClock()
          hideOverlay()
          if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
          runStartedAt = 0
          lastToolCount = 0
          return
        }
        var snap = currentSnap(sessions)
        var list = sessions && sessions.list ? sessions.list.getSnapshot() : null
        var summary = list && list.current && list.byId ? list.byId[list.current] : null
        var running = !!(snap && snap.running) || !!(summary && summary.running)

        if (running) {
          if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
          if (runStartedAt === 0) runStartedAt = Date.now()
          var liveCalls = snap && snap.runningCalls ? snap.runningCalls.length : 0
          if (liveCalls > lastToolCount) lastToolCount = liveCalls
          setRunningFlag(true)
          var act = activityNow(snap)
          if (!act.detail) {
            var think = latestThinkSnippet()
            if (think.text) act = { verb: t('thinking'), detail: think.text, kind: 'think' }
          }
          showOverlay(act.verb, act.detail || '', formatElapsed(Date.now() - runStartedAt), stepLabel(Math.max(1, lastToolCount)), false)
          startClock()
          return
        }

        stopClock()
        setRunningFlag(false)
        if (runStartedAt > 0) {
          // The folded recap is the completion affordance. Remove the fixed layer
          // immediately so it never overlaps the answer as streaming settles.
          hideOverlay()
          runStartedAt = 0
          lastToolCount = 0
          return
        }
        if (!fromClock) hideOverlay()
      }

      function queueRefresh() {
        if (refreshQueued) return
        refreshQueued = true
        requestAnimationFrame(function () {
          refreshQueued = false
          refreshRun(false)
          syncGroups(false)
          syncThink(false)
          if (overlayOn) placeOverlay()
        })
      }

      var sessionUnsub = null
      var watchedId = null
      function watchSession() {
        var list = sessions && sessions.list ? sessions.list.getSnapshot() : null
        var id = list && list.current
        if (id === watchedId && sessionUnsub) return
        watchedId = id
        if (typeof sessionUnsub === 'function') { sessionUnsub(); sessionUnsub = null }
        var b = currentBinding(sessions)
        if (b === null || !b.session || typeof b.session.subscribe !== 'function') return
        sessionUnsub = b.session.subscribe(function () { queueRefresh() })
        queueRefresh()
      }

      var listUnsub = null
      if (sessions && sessions.list && typeof sessions.list.subscribe === 'function') {
        listUnsub = sessions.list.subscribe(function () { watchSession() })
      }
      watchSession()

      var unstore = subscribe(function () {
        syncSegmented(fallbackHost)
        if (mode === 'verbose') {
          clearGroups()
          hideThink()
        }
        queueRefresh()
        fallbackHidden = false
        lastFallbackBox = ''
        placeFallback()
      })

      function onKey(e) {
        if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
        var map = { '1': 'verbose', '2': 'normal', '3': 'summary' }
        if (map[e.key]) {
          e.preventDefault()
          setMode(map[e.key])
        }
      }
      document.addEventListener('keydown', onKey, true)

      var layoutRaf = false
      function onPlaceOnly() {
        if (groupMotionActive > 0) return
        if (layoutRaf) return
        layoutRaf = true
        requestAnimationFrame(function () {
          layoutRaf = false
          if (overlayOn) placeOverlay()
          if (!fallbackHidden) placeFallback()
        })
      }
      function bindConvScroll() {
        var el = document.querySelector('[data-conversation-scroll]')
        if (el === scrollBound) return
        if (scrollBound) scrollBound.removeEventListener('scroll', onPlaceOnly)
        scrollBound = el
        if (el) el.addEventListener('scroll', onPlaceOnly, { passive: true })
      }
      function bindFlowResize() {
        var flow = document.querySelector('[data-chat-flow]')
        if (flow === flowBound) return
        if (flowRO) { flowRO.disconnect(); flowRO = null }
        flowBound = flow
        if (!flow || typeof ResizeObserver === 'undefined') return
        flowRO = new ResizeObserver(function () { onPlaceOnly() })
        flowRO.observe(flow)
      }
      function onThinkClick(e) {
        var tgt = e.target
        if (!(tgt && tgt.closest && tgt.closest('[data-variant="think"]'))) return
        requestAnimationFrame(function () { syncThink(true) })
      }
      function onFoldClick(e) {
        if (resettingNativeDetails) return
        var tgt = e.target
        if (!(tgt && tgt.closest)) return
        var recap = tgt.closest('[data-dsh-om-trole="head"][data-dsh-om-tid]')
        if (recap) {
          var packed = recap.getAttribute('data-dsh-om-briefpack') === '1'
          if (!packed) {
            var recBox = recap.getBoundingClientRect()
            if (e.clientY > recBox.top + 26) return
          }
          var tid = recap.getAttribute('data-dsh-om-tid')
          if (!tid) return
          e.preventDefault()
          e.stopPropagation()
          recapOpen[tid] = packed
          syncGroups(true)
          return
        }
        var head = tgt.closest('[data-dsh-om-grole="head"]')
        if (!head) return
        var gid = head.getAttribute('data-dsh-om-gid')
        if (!gid) return
        var isOpen = head.getAttribute('data-dsh-om-gopen') === '1'
        if (isOpen) {
          var box = head.getBoundingClientRect()
          if (e.clientY > box.top + 24) return
        }
        e.preventDefault()
        e.stopPropagation()
        animateGroup(gid, !isOpen)
      }
      document.addEventListener('click', onThinkClick, true)
      document.addEventListener('click', onFoldClick, true)
      window.addEventListener('resize', onPlaceOnly)
      bindConvScroll()
      bindFlowResize()

      // 只在对话壳出现/消失时摆一次回退切换器，绝不跟着 token 扫树。
      var mountTimer = null
      function schedulePlaceFallback() {
        if (fallbackHidden) return
        if (mountTimer !== null) return
        mountTimer = setTimeout(function () {
          mountTimer = null
          placeFallback()
        }, 400)
      }
      var observer = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var tnode = records[i].target
          if (tnode === fallbackHost || overlay.contains(tnode) || fallbackHost.contains(tnode)) continue
          if (tnode === document.body || (tnode.nodeType === 1 && (
            tnode.hasAttribute('data-conversation-scroll')
            || tnode.hasAttribute('data-composer-card')
            || tnode.hasAttribute('data-phase')
            || tnode.tagName === 'HEADER'
          ))) {
            schedulePlaceFallback()
            return
          }
        }
      })
      observer.observe(document.body, { childList: true, subtree: false })
      var scrollEl = document.querySelector('[data-conversation-scroll]')
      if (scrollEl && scrollEl.parentElement) {
        observer.observe(scrollEl.parentElement, { childList: true, subtree: false })
      }

      placeFallback()
      setTimeout(function () { placeFallback(); bindConvScroll(); bindFlowResize() }, 400)
      queueRefresh()

      return function () {
        observer.disconnect()
        document.removeEventListener('keydown', onKey, true)
        document.removeEventListener('click', onThinkClick, true)
        document.removeEventListener('click', onFoldClick, true)
        window.removeEventListener('resize', onPlaceOnly)
        if (scrollBound) scrollBound.removeEventListener('scroll', onPlaceOnly)
        if (flowRO) flowRO.disconnect()
        if (typeof listUnsub === 'function') listUnsub()
        if (typeof sessionUnsub === 'function') sessionUnsub()
        if (typeof unstore === 'function') unstore()
        if (typeof localeUnsub === 'function') localeUnsub()
        if (typeof unregisterLocale === 'function') unregisterLocale()
        localeTranslate = null
        localeService = null
        if (hideTimer) clearTimeout(hideTimer)
        if (mountTimer) clearTimeout(mountTimer)
        stopClock()
        slotDisposers.forEach(function (d) { try { if (typeof d === 'function') d() } catch (_) { /* */ } })
        clearGroups()
        hideThink()
        fallbackHost.remove()
        overlay.remove()
        document.documentElement.removeAttribute(ATTR)
        document.documentElement.removeAttribute('data-dsh-om-running')
        if (document.body) document.body.removeAttribute(ATTR)
        var tag = document.getElementById(STYLE_ID)
        if (tag) tag.remove()
      }
    }

    exports.name = 'dsh-view-modes'
    exports.inject = ['sessions', 'locale']
    exports.apply = apply
    return module.exports
  },
})
