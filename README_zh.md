# agy-genui

> **🌐 [English](./README.md)**

**Antigravity 生成式 UI 插件** —— 用声明式 JSON 在模型回复中直接渲染交互式 UI 组件，通过 Antigravity 原生的 `<agent-embed>` 内联嵌入。

让模型说「给我一个可排序的 Token 用量表格」时，得到真正的交互表格 —— 排序、筛选、图表、表单、测验，直接嵌在对话里，而不是纯文本堆砌。

零外部依赖、CSP 安全、主题自适应。

---

## 为什么需要它

Antigravity 原生支持 `<agent-embed src="file:///.../widget.html">` 内联小部件。但让模型现场手写 HTML/JS/CSS 既浪费 Token 又容易出错，而且外部 CDN 被 CSP 阻断。

`agy-genui` 把模型的工作变成：**只输出一小段声明式 JSON DSL，渲染器由插件提供。**

```
模型 → ```agy-ui {JSON} ``` → build.mjs → 自包含 widget.html → <agent-embed>
```

---

## 特性

- **20 个现成组件** —— stat（含 sparkline/delta）、可排序/筛选/分页表格、SVG 图表（柱/线/饼）、进度条（线性/环形）、diff、tabs、accordion、card、row、timeline、tree、form、quiz、button、callout、badge、code、plot、markdown、image
- **零依赖** —— 无 CDN、无运行时 npm；全部内联进单个 HTML
- **CSP 安全** —— `default-src 'none'`，无 `eval`、无外部脚本
- **主题自适应** —— CSS 变量自动适配 Antigravity 深/浅色主题
- **双向动作环** —— 表单/测验/按钮通过 `postMessage` 把 `action` 回传宿主
- **本地优先** —— 排序、筛选、分页、判分全部客户端完成

---

## 安装

```bash
agy plugin install ./agy-genui
```

或从 GitHub：

```bash
agy plugin install https://github.com/<you>/agy-genui
```

无需 sidecar 或额外配置 —— 本插件纯靠技能与 `<agent-embed>` 机制工作。

---

## 使用

### 1. 模型输出 DSL 块

````markdown
```agy-ui
{
  "type": "echart",
  "title": "月度 Token 消耗",
  "echart": {
    "preset": "bar",
    "xKey": "month",
    "data": [
      { "month": "1月", "value": 12000 },
      { "month": "2月", "value": 15000 }
    ],
    "series": [{ "key": "value", "name": "Token", "type": "bar" }]
  }
}
```
````

### 2. 打包成自包含 widget

```bash
node skills/agy-genui/src/build.mjs spec.json skills/agy-genui/dist/my-widget.html
```

也可直接管道输入 DSL 块：

```bash
echo '{"type":"stat","label":"Token","value":"1.2M"}' | \
  node skills/agy-genui/src/build.mjs - skills/agy-genui/dist/my-widget.html
```

### 3. 在回复中嵌入

```html
<agent-embed src="file:///D:/Mygit/agy-genui/skills/agy-genui/dist/my-widget.html"></agent-embed>
```

完整 DSL 参考与组件目录见 [SKILL.md](./skills/agy-genui/SKILL.md)。

---

## 目录结构

```
agy-genui/
├── plugin.json                  # 插件清单
├── README.md / README_zh.md     # 文档
├── LICENSE                      # MIT
├── assets/logo.svg              # 插件 logo
└── skills/agy-genui/
    ├── SKILL.md                 # DSL 参考 + 组件目录
    ├── src/
    │   ├── build.mjs            # DSL JSON → 自包含 HTML
    │   ├── shell.html           # HTML 外壳（CSP + 占位符）
    │   ├── style.css            # 主题自适应样式
    │   ├── renderer.js          # 白名单组件渲染器
    │   └── example*.spec.json   # 示例 DSL
    └── dist/                    # 生成的 widget
```

---

## 安全

- 严格组件白名单；未知类型显示错误提示，不会崩溃
- 无 `eval`、无脚本注入、不收集密钥
- 脚本/样式全部内联，无外部 CDN
- CSP：`default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: https: blob:`

---

## 状态

v1.0.0 —— 基础组件库已实现。规划中（尚未实现）：`three`（3D）、`mermaid`、`video`、`audio`、`carousel`、ECharts 完整 option 模式。以 SKILL.md 的白名单为准。

## 许可证

MIT
