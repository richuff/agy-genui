---
name: agy-genui
description: Antigravity Generative UI 技能。让模型通过声明式 JSON DSL 直接在回复中渲染交互式 UI 组件（图表、表格、代码差异、3D 场景、表单/测验、代码差异等），支持流式增量挂载、本地优先交互、双向动作环。
---

# Antigravity Generative UI (agy-genui)

为 Antigravity 提供 **Generative UI（生成式 UI）** 能力：模型只需输出声明式 JSON DSL，即可在侧边栏或聊天气泡中渲染交互式 UI 组件（图表、表格、代码差异、3D 场景、表单/测验、代码差异、时间线等）。

## 核心特性

- **声明式 DSL**：模型只需输出结构化 JSON，无需编写 HTML/JS/CSS
- **30+ 组件生态**：图表、表格、代码差异、3D 场景、表单/测验、时间线、文件树、代码块、进度条、徽章...
- **流式增量挂载**：组件随 Token 流式增量挂载，无需等待完整回复
- **本地优先交互**：排序、筛选、折叠、拖拽、滑块全在客户端零延迟完成
- **双向动作环**：按钮点击可回传 `action` 给模型触发后续推理
- **离线资源预置**：ECharts/Three.js/Mermaid/KaTeX 等重型引擎本地预置，按需懒加载
- **双向动作环**：组件内按钮/表单可回传 `action` 给模型触发后续推理
- **主题自适应**：自动适配 Antigravity 深/浅色、紧凑模式、缩放
- **安全沙箱**：白名单组件、CSP 兼容、无脚本注入风险

## 组件库

### 已实现（v1.0.0，零外部依赖、CSP 安全）

| 类别 | 组件 | 描述 |
|------|------|------|
| **数据展示** | `stat` | KPI 卡片，支持 eyebrow、delta、sparkline |
| | `table` | 可排序/筛选/分页表格，支持 number/currency/badge/bar/sparkline 列 |
| | `progress` | 线性/环形进度条，支持 label/value/max/variant |
| | `badge` | 状态徽章，支持 tone 变体 |
| **图表** | `echart` | SVG 图表，支持 `line` / `area` / `bar` / `stackedBar` / `pie` / `donut` / `scatter`，带悬停提示、图例联动、十字准线 |
| | `plot` | 函数绘图预览（DSL 提供采样点 samples；浏览器内不执行表达式，安全） |
| | `sparkline` | stat/table 内联微型趋势图 |
| **代码/文本** | `code` | 代码块（纯文本转义展示） |
| | `diff` | 并排代码差异对比 |
| | `markdown` | 纯文本展示（预留 KaTeX 扩展） |
| **交互/表单** | `form` | 声明式表单，提交回传 action |
| | `quiz` | 单选/多选测验，即时评分与解析，回传 action |
| | `button` | 动作按钮，回传 action 触发模型后续推理 |
| **布局/导航** | `tabs` | 标签页容器 |
| | `accordion` | 可折叠面板 |
| | `card` | 卡片容器 |
| | `row` | 水平排列容器 |
| | `flow` | **流程图**：分层车道 + 自动箭头，支持决策菱形与分支 |
| | `timeline` | 时间线/步骤流 |
| | `tree` | 可折叠文件树/目录树 |
| **媒体** | `image` | 图片预览 |
| **反馈** | `callout` | 高亮提示块，支持 info/success/warning/error 色调 |

### 规划中（尚未实现，请勿在 DSL 中使用）

`three`（3D 场景）、`mermaid`（图表）、`video`、`audio`、`carousel`、`divider`、`toast`、`form-field`（独立字段）、ECharts 完整 option 模式。

> 组件白名单以 `skills/agy-genui/src/renderer.js` 的 `R` 对象为准；未知类型会显示「未知组件类型」而不会崩溃。

## DSL 语法

模型在回复中输出以下格式的代码块（语言标识符为 `agy-ui`）：

````markdown
```agy-ui
{
  "type": "echart",
  "title": "月度 Token 消耗趋势",
  "echart": {
    "preset": "bar",
    "xKey": "month",
    "data": [
      { "month": "1月", "value": 12000 },
      { "month": "2月", "value": 15000 },
      { "month": "3月", "value": 18000 }
    ],
    "series": [{ "key": "value", "name": "Token", "type": "bar" }]
  }
}
```
````

### 统一顶层字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 组件类型，见组件库表 |
| `title` | string | 否 | 组件标题 |
| `description` | string | 否 | 组件描述/副标题 |
| `interactive` | boolean | 否 | 是否启用交互（默认 true） |
| `action` | object | 否 | 交互动作回传配置 |

### 组件特有字段

#### `stat` - KPI 卡片
```json
{
  "type": "stat",
  "label": "Token 总消耗",
  "value": "1.2M",
  "delta": "+12.4%",
  "deltaType": "increase",
  "sparkline": [1200, 1500, 1800, 2200, 2500],
  "eyebrow": "本月累计"
}
```

#### `table` - 可交互表格
```json
{
  "type": "table",
  "columns": [
    { "key": "name", "title": "会话", "sortable": true },
    { "key": "tokens", "title": "Token", "type": "number", "sortable": true },
    { "key": "cost", "title": "费用", "type": "currency", "format": "$0.00" },
    { "key": "status", "title": "状态", "type": "badge", "mapping": { "active": "success", "idle": "gray" } }
  ],
  "data": [
    { "name": "会话 A", "tokens": 12000, "cost": 0.12, "status": "active" },
    { "name": "会话 B", "tokens": 8000, "cost": 0.08, "status": "idle" }
  ],
  "sortable": true,
  "filterable": true,
  "exportable": true,
  "pagination": { "pageSize": 20 },
  "rowActions": [
    { "label": "查看详情", "action": { "type": "open_session", "payload": { "sessionId": "{{row.id}}" } } }
  ]
}
```

#### `echart` - 图表（含交互）

**折线图（推荐用于趋势）**

```json
{
  "type": "echart",
  "title": "Token 消耗趋势",
  "echart": {
    "preset": "line",
    "xKey": "month",
    "data": [
      { "month": "1月", "tokens": 12000, "cost": 120 },
      { "month": "2月", "tokens": 15500, "cost": 148 },
      { "month": "3月", "tokens": 18200, "cost": 176 }
    ],
    "series": [
      { "key": "tokens", "name": "Token", "color": "#3b82f6", "smooth": true },
      { "key": "cost", "name": "费用", "color": "#10b981", "smooth": true }
    ]
  }
}
```

**面积图**：`preset` 改为 `"area"`，折线下方叠加渐变填充。

**分组柱状图**：`preset: "bar"` + 多个系列即自动分组。

**堆叠柱状图**：

```json
{
  "type": "echart",
  "echart": {
    "preset": "stackedBar",
    "xKey": "week",
    "data": [{ "week": "第1周", "a": 3200, "b": 2100 }],
    "series": [
      { "key": "a", "name": "工具执行", "color": "#2f6df6" },
      { "key": "b", "name": "模型回复", "color": "#8b5cf6" }
    ]
  }
}
```

**环形图（带中心数值）**：

```json
{
  "type": "echart",
  "title": "上下文构成",
  "echart": {
    "preset": "donut",
    "xKey": "type",
    "data": [
      { "type": "工具结果", "value": 83100 },
      { "type": "工具定义", "value": 38300 }
    ],
    "series": [{ "key": "value", "name": "上下文" }]
  }
}
```

环形图中心显示总量；悬停某扇区时切换为该项目的名称与占比。

**饼图**：`preset` 改为 `"pie"`（实心，无中心数值）。

**散点图**：`preset: "scatter"`，适合展示离群点与分布。

> 完整可运行示例见 `src/example-charts.spec.json`。

**preset 模式**：`line`、`area`、`bar`、`groupedBar`、`stackedBar`、`pie`、`donut`、`scatter`

> 旧版文档提到的雷达/仪表盘/漏斗/树图等重型图表未实现（需 ECharts 等外部依赖，与零依赖 + 严格 CSP 冲突）。当前引擎为自研纯 SVG 实现。

**系列字段**

| 字段 | 说明 |
|---|---|
| `key` | 取数据里的哪个字段 |
| `name` | 图例显示名 |
| `type` | 覆盖主类型，可混搭（如主 `bar`、某系列 `line`） |
| `color` | 十六进制色，省略则取内置调色板 |
| `smooth` | 折线/面积是否平滑（Catmull-Rom 曲线） |
| `points` | 折线是否画数据点，默认 true |

**交互能力**（参考 agy-context 的做法）

| 交互 | 行为 |
|---|---|
| **悬停数据点/柱子** | 该系列高亮、其余淡化到 22%；浮动 tooltip 显示该列所有系列的值 |
| **十字准线** | 折线/面积/散点图悬停时出现垂直虚线，跟随当前列 |
| **图例悬停** | 高亮对应系列，其余淡化 |
| **图例点击** | 切换该系列显隐（至少保留一个可见系列） |
| **饼图扇区悬停** | 扇区放大 3.5%、其余淡化到 35%；环形图中心切换显示该项目名称与占比 |
| **饼图图例** | 悬停联动高亮；点击可将扇区置顶强调（`pinned`） |

**坐标轴**

- Y 轴刻度自动取「好看」步长（1/2/5×10ⁿ），并始终从 0 起，避免视觉误导
- X 轴标签按宽度自动抽稀，超长截断为 8 字符加省略号
- 数值自动缩写：`12.0K` / `1.5M` / `2.3B`

#### `plot` - 数学函数绘图
```json
{
  "type": "plot",
  "title": "函数曲线",
  "functions": [
    { "expr": "sin(x)", "label": "sin(x)", "color": "#3b82f6" },
    { "expr": "cos(x)", "label": "cos(x)", "color": "#ef4444" },
    { "expr": "a * sin(b * x)", "label": "a·sin(bx)", "params": { "a": 1, "b": 1 }, "sliders": { "a": { "min": 0.5, "max": 3, "step": 0.1 }, "b": { "min": 0.5, "max": 5, "step": 0.1 } } }
  ],
  "xRange": [-10, 10],
  "yRange": [-2, 2]
}
```

#### `diff` - 代码差异
```json
{
  "type": "diff",
  "title": "重构前后对比",
  "oldCode": "function foo() { return 1; }",
  "newCode": "function foo() { return 2; }",
  "language": "javascript",
  "mode": "side-by-side"
}
```

#### `form` - 声明式表单
```json
{
  "type": "form",
  "title": "会话筛选",
  "fields": [
    { "key": "keyword", "type": "text", "label": "关键词", "placeholder": "搜索标题/ID" },
    { "key": "model", "type": "select", "label": "模型", "options": [{ "value": "gemini-2.5-pro", "label": "Gemini 2.5 Pro" }] },
    { "key": "dateRange", "type": "date-range", "label": "时间范围" }
  ],
  "submitAction": {
    "type": "filter_sessions",
    "payload": { "keyword": "{{form.keyword}}", "model": "{{form.model}}" }
  }
}
```

#### `quiz` - 测验
```json
{
  "type": "quiz",
  "title": "Antigravity 知识测验",
  "questions": [
    {
      "type": "single",
      "question": "Antigravity 的前身是什么？",
      "options": ["Gemini CLI", "Claude Code", "Cursor", "Codex"],
      "answer": 0,
      "explanation": "Antigravity 是 Google Gemini CLI 的继任者。"
    },
    {
      "type": "multiple",
      "question": "以下哪些模型支持 Thinking？",
      "options": ["gemini-2.5-pro", "gemini-2.0-flash-thinking", "gemini-2.5-flash", "gemini-1.5-pro"],
      "answer": [0, 1],
      "explanation": "仅 gemini-2.5-pro 和 gemini-2.0-flash-thinking 支持思维链。"
    }
  ],
  "showScore": true,
  "allowRetry": true
}
```

#### `progress` - 进度条
```json
{
  "type": "progress",
  "label": "上下文占用",
  "value": 72,
  "max": 100,
  "variant": "ring",
  "color": "blue",
  "showLabel": true
}
```

#### `tabs` / `accordion` / `card` - 布局容器
```json
{
  "type": "tabs",
  "tabs": [
    { "label": "概览", "content": { "type": "stat", ... } },
    { "label": "详情", "content": { "type": "table", ... } }
  ]
}
```

#### `flow` - 流程图（推荐用于流程/架构/决策链路）

用**车道（lane）**表达阶段，节点自动用箭头连接，避免手拼 `row`/`card` 造成的错位。

```json
{
  "type": "flow",
  "lanes": [
    {
      "name": "阶段一：路由判定（做决策）",
      "steps": [
        { "k": "process", "label": "拿到问题和 turn_no" },
        { "k": "decision", "label": "查一下 turn_no > 1 ？", "edgeLabel": "纯内存 if 判断" },
        { "k": "process", "label": "决定：走深度思考通道", "sub": "耗时 ≈ 0 ms" }
      ]
    },
    {
      "name": "阶段二：深度思考通道",
      "steps": [
        { "k": "process", "label": "1. 知识库召回", "sub": "2~3s" },
        { "k": "process", "label": "2. 大模型推理生成", "sub": "10~25s" },
        { "k": "note", "label": "💡 实际总耗时：15~30 秒" }
      ]
    }
  ]
}
```

**节点字段**

| 字段 | 说明 |
|------|------|
| `k` | 节点类型：`process`（矩形）/ `decision`（菱形）/ `note`（虚线说明）/ `start` / `end`（圆角胶囊） |
| `label` | 主文字 |
| `sub` | 第二行小字（如耗时） |
| `edgeLabel` | 画在本节点**前面那根箭头**上的标签（如「纯内存 if 判断」） |

**车道字段**：`name`（阶段标题）、`steps`（节点数组）、`branch`（可选，`{label, steps}` 在主轨下方画一条分支行）。

> 布局采用 flex 车道式排列（非绝对定位），节点垂直居中对齐；窄屏时车道内部横向滚动而非挤压错位。**流程图请用 `flow`，不要用 `row` + `card` 手工拼。**

#### `three` - 3D 场景
```json
{
  "type": "three",
  "title": "3D 模型预览",
  "scene": {
    "type": "gltf",
    "url": "https://example.com/model.gltf",
    "autoRotate": true,
    "camera": { "fov": 45, "position": [0, 2, 5] }
  }
}
```

#### `action` - 双向动作环
```json
{
  "type": "button",
  "label": "刷新统计",
  "variant": "primary",
  "action": {
    "type": "trigger_skill",
    "skill": "agy-stats",
    "payload": { "refresh": true }
  }
}
```

## 双向动作环

组件内的交互元素（按钮、表单提交、表格行动作、测验提交）可包含 `action` 字段，当用户触发时，插件通过 Antigravity 的 `send_input` 或 sidecar 通道将结构化 payload 回传给模型，触发后续推理。

```json
{
  "type": "button",
  "label": "查看会话详情",
  "action": {
    "type": "open_session",
    "payload": { "sessionId": "abc123" }
  }
}
```

支持的 action 类型：
- `open_session` - 打开指定会话
- `trigger_skill` - 触发另一个技能
- `run_command` - 执行 shell 命令
- `filter_data` - 筛选当前视图数据
- `navigate` - 导航到指定 URL/路径
- `copy` - 复制文本到剪贴板
- `custom` - 自定义 payload，由模型自行处理

## 技能调用方式

模型在回复中直接输出 `agy-ui` 代码块，插件自动检测并渲染。也可通过显式调用：

```
Use agy-genui to render a dashboard with token stats table and trend chart.
```

## 生成 Widget HTML（使用 build.mjs）

模型输出 DSL 后，用打包脚本把它转成自包含 HTML，再在回复中通过 `<agent-embed>` 嵌入：

```bash
# 从 JSON 文件打包
node skills/agy-genui/src/build.mjs spec.json skills/agy-genui/dist/my-widget.html

# 从 stdin 打包（支持直接粘贴 ```agy-ui 代码块）
echo '{"type":"stat","label":"Token","value":"1.2M"}' | node skills/agy-genui/src/build.mjs - skills/agy-genui/dist/my-widget.html
```

随后在回复中嵌入：

```html
<agent-embed src="file:///D:/Mygit/agy-genui/skills/agy-genui/dist/my-widget.html"></agent-embed>
```

脚本会把 `style.css` + `renderer.js` + DSL spec 全部内联进 `shell.html`，生成一个**零外部依赖、CSP 安全**的独立 HTML。

## 技术实现

- **渲染引擎**：纯内联 JS（`src/renderer.js`），白名单组件，无 `eval`、无外部脚本
- **图表引擎**：`src/charts.js` 自研 SVG 实现，零依赖；支持 8 种图表类型 + 完整交互（悬停高亮、图例联动、十字准线、扇区外扩、浮动 tooltip）
- **主题适配**：CSS 变量自动适配 Antigravity `--background`/`--foreground`/`--chart-*` 主题变量，支持深/浅色
- **双向动作环**：表单/测验/按钮通过 `window.parent.postMessage` 把 `action` 回传宿主
- **流式挂载**：预留；当前为一次性渲染（spec 就绪后挂载全部组件）
- **CSP**：`default-src 'none'`，样式与脚本均内联，图片仅允许 data:/https:/blob:

## 版本历史

- v1.1.0 - 图表引擎强化：新增 `line`（真折线）/ `area` / `stackedBar` / `donut` / `scatter`；
  加入悬停高亮、图例悬停联动与点击显隐、十字准线、饼图扇区外扩与中心数值切换、
  浮动 tooltip；坐标轴智能刻度与标签抽稀
- v1.0.0 - 初始版本，支持基础组件库

## 许可证

MIT