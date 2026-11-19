#!/usr/bin/env node
/**
 * build.mjs — agy-genui widget 打包器
 *
 * 用法：
 *   node skills/agy-genui/src/build.mjs <spec.json> <out.html>
 *   echo '<json>' | node skills/agy-genui/src/build.mjs - <out.html>
 *
 * 读取声明式 DSL（JSON），把样式与渲染器内联进 shell.html，
 * 输出一个自包含、CSP 安全、可直接被 <agent-embed> 加载的 HTML。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '..');
const SHELL = resolve(__dirname, 'shell.html');
const STYLE = resolve(__dirname, 'style.css');
const RENDERER = resolve(__dirname, 'renderer.js');
const CHARTS = resolve(__dirname, 'charts.js');

function fail(msg) { console.error('[agy-genui] ERROR: ' + msg); process.exit(1); }

function readSpec(input) {
  let raw;
  if (!input || input === '-') raw = readFileSync(0, 'utf8');
  else raw = readFileSync(resolve(input), 'utf8');
  // 支持从 markdown 代码块里提取：```agy-ui ... ```
  const fence = raw.match(/```agy-ui\s*\n([\s\S]*?)\n```/);
  if (fence) raw = fence[1];
  return JSON.parse(raw);
}

/** 防止 spec 中的 </script> 提前闭合内联脚本 */
function safeJson(spec) {
  return JSON.stringify(spec).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function build(spec) {
  if (!spec || typeof spec !== 'object') fail('spec 必须是 JSON 对象');
  const shell = readFileSync(SHELL, 'utf8');
  const style = readFileSync(STYLE, 'utf8');
  const charts = readFileSync(CHARTS, 'utf8');
  const renderer = readFileSync(RENDERER, 'utf8');
  const json = safeJson(spec);
  // 用函数形式替换，避免替换串中的 $& / $' / $` 被当成特殊模式而截断内容
  // 注意：charts.js 必须在 renderer.js 之前注入，renderer 依赖 AgyGenUICharts
  const html = shell
    .replace('/*__STYLE__*/', () => style)
    .replace('/*__CHARTS__*/', () => charts)
    .replace('/*__RENDERER__*/', () => renderer)
    .replace('/*__SPEC__*/', () => json);
  return html;
}

// ---- main ----
const [input, output] = process.argv.slice(2);
if (!output) {
  console.log('用法: node build.mjs <spec.json|-> <out.html>');
  process.exit(1);
}
let spec;
try { spec = readSpec(input); }
catch (e) { fail('解析 spec 失败: ' + e.message); }

const html = build(spec);
const outPath = resolve(output);
const dir = dirname(outPath);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
writeFileSync(outPath, html, 'utf8');
console.log('[agy-genui] 已生成: ' + outPath + ' (' + Buffer.byteLength(html, 'utf8') + ' bytes)');
console.log('[agy-genui] 在回复中嵌入: <agent-embed src="file:///' + outPath.replace(/\\/g, '/') + '"></agent-embed>');
