// acceptance.mjs — 真机验收脚本（dsh-research-desk）
//
// 装进一台真实的 DSH 宿主，一次性把四段验掉：
//   A 环境与插件安装
//   B 宿主路由与非模型动作（status / models / settings / search / add / library / read）
//   C 四条模型路径（ask / review / hypothesis / draft）
//   D 侧栏面板渲染 / 导出 / 外部工具闸门 / MCP stdio
//
// 用法：
//   node test/acceptance.mjs
//   node test/acceptance.mjs --skip-model        # 跳过需要真实模型的四段
//   node test/acceptance.mjs --only=B,C          # 只跑指定分组
//   node test/acceptance.mjs --port=2601 --profile=rd-accept
//   node test/acceptance.mjs --keep-state         # 不还原文献库
//   node test/acceptance.mjs --keep-server        # 验收完不关实例
//
// 脚本自己拉起一个独立的 web profile 实例（默认端口 2599，被占用就顺延），
// 验收完关掉它，并还原它动过的文献库。日常用的 desktop 实例不会被碰到。
//
// 环境变量：
//   DSH_EXE            宿主 exe 路径
//   DSH_CLI_JS         宿主 cli.js 路径
//   EDGE_EXE           Edge 可执行文件路径（渲染检查用）
//   DSH_ACCEPT_MODEL   强制使用的 provider/model
//   DSH_ACCEPT_PROFILE 宿主 profile 名
//   DSH_ACCEPT_PORT    宿主端口

import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SETTING_DEFS } from '../lib/settings.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ROUTE = '/api/research-desk/'
const HOME = process.env.DSH_HOME || join(process.env.USERPROFILE || '', '.dsh')
const STATE_FILE = join(HOME, 'research-desk', 'state.json')

const argv = process.argv.slice(2)
const flag = name => argv.some(a => a === name || a.startsWith(name + '='));
const value = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(name + '='));
  return hit ? hit.slice(name.length + 1) : fallback;
};

const PROFILE = value('--profile', process.env.DSH_ACCEPT_PROFILE || 'web');
const PORT_BASE = Number(value('--port', process.env.DSH_ACCEPT_PORT || '2599'));
const onlyRaw = value('--only', '');
const ONLY = onlyRaw ? onlyRaw.split(',').map(s => s.trim()).filter(Boolean) : null;
const SKIP_MODEL = flag('--skip-model');
const KEEP_STATE = flag('--keep-state');
const KEEP_SERVER = flag('--keep-server');
const FORCED_MODEL = process.env.DSH_ACCEPT_MODEL || '';

const HARNESS_EXE = process.env.DSH_EXE || 'D:/opt/DeepSeek Harness/DeepSeek Harness.exe';
const CLI_JS = process.env.DSH_CLI_JS || 'D:/opt/DeepSeek Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js';
const EDGE_EXE = process.env.EDGE_EXE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const results = [];
let failures = 0;
let skips = 0;
let server = null;
let stateBackup = null;

function section(title) {
  console.log('');
  console.log('=== ' + title + ' ===');
}

function check(name, ok, detail) {
  const good = !!ok;
  if (!good) failures++;
  results.push({ name, ok: good, detail: detail || '' });
  console.log('[' + (good ? 'PASS' : 'FAIL') + '] ' + name + (detail ? '  |  ' + detail : ''));
  return good;
}

function skip(name, reason) {
  skips++;
  results.push({ name, ok: false, skipped: true, detail: reason });
  console.log('[SKIP] ' + name + '  |  ' + reason);
}

function wanted(group) {
  return !ONLY || ONLY.includes(group);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function runCli(args, timeoutMs) {
  return new Promise(resolve => {
    const child = spawn(HARNESS_EXE, ['--expose-internals', CLI_JS].concat(args), {
      env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }),
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    const timer = setTimeout(() => { child.kill(); }, timeoutMs || 240000);
    child.on('error', e => { clearTimeout(timer); resolve({ code: -1, out, err: String(e && e.message) }); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, out, err }); });
  });
}

async function post(base, payload, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers['x-dsh-auth-token'] = token;
  const res = await fetch(base + ROUTE, { method: 'POST', headers, body: JSON.stringify(payload) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (err) { json = null; }
  return { status: res.status, json, text };
}

async function portBusy(port) {
  try {
    const res = await fetch('http://127.0.0.1:' + port + '/', { method: 'GET' });
    return res.status;
  } catch (err) {
    return null;
  }
}

async function pickPort(start) {
  for (let p = start; p < start + 20; p++) {
    if ((await portBusy(p)) === null) return p;
  }
  return start;
}

function bootServer(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(HARNESS_EXE, ['--expose-internals', CLI_JS, '--profile', PROFILE, '--no-open', '--port', String(port)], {
      env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let buf = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error('实例 150s 内没有打印带 token 的地址'));
    }, 150000);
    const onChunk = chunk => {
      buf += chunk;
      const m = buf.match(/https?:\/\/127\.0\.0\.1:\d+\/\?token=([A-Za-z0-9._-]+)/);
      if (m && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve({
          child,
          token: m[1],
          base: 'http://127.0.0.1:' + port,
          url: 'http://127.0.0.1:' + port + '/?token=' + m[1],
          log: () => buf,
        });
      }
    };
    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);
    child.on('error', err => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('实例提前退出 exit=' + code + '：' + buf.slice(-400)));
    });
  });
}

// Edge 的 --dump-dom 从 Node spawn 出来会吐 0 字节（浏览器进程把 stdout 让给了
// 已有的 Edge 实例），所以渲染检查走 CDP：自己起一个带调试端口的 Edge，
// 导航到目标页，再从 Runtime.evaluate 取 document.documentElement.outerHTML。
async function dumpDom(url) {
  const dir = mkdtempSync(join(tmpdir(), 'rd-edge-'));
  const dbgPort = await freePort(9333);
  const child = spawn(EDGE_EXE, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--window-size=1500,950',
    '--user-data-dir=' + dir,
    '--remote-debugging-port=' + dbgPort,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', d => { stderr += d; });
  const kill = () => { try { child.kill('SIGKILL'); } catch (err) { /* 已经退了 */ } };
  try {
    const target = await waitFor(async () => {
      const res = await fetch('http://127.0.0.1:' + dbgPort + '/json/list');
      const list = await res.json();
      const page = list.find(t => t.type === 'page');
      return page ? page.webSocketDebuggerUrl : null;
    }, 30000);
    if (!target) throw new Error('Edge 调试端口没起来：' + stderr.slice(-300));
    const html = await cdpEval(target, url, 12000);
    if (!html) throw new Error('页面渲染后拿不到 HTML');
    return html;
  } finally {
    kill();
    try { rmSync(dir, { recursive: true, force: true }); } catch (err) { /* 临时目录留着也无妨 */ }
  }
}

// CDP 最小客户端：连上 target，导航到 url，等页面稳定后取 outerHTML。
function cdpEval(target, url, settleMs) {
  return new Promise(resolve => {
    const ws = new WebSocket(target);
    let nextId = 1;
    const pending = new Map();
    const send = (method, params) => new Promise(res => {
      const id = nextId++;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
    ws.addEventListener('message', ev => {
      let msg = null;
      try { msg = JSON.parse(ev.data); } catch (err) { return; }
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    });
    const done = html => { try { ws.close(); } catch (err) { /* 已经关了 */ } resolve(html || ''); };
    const timer = setTimeout(() => done(''), 60000);
    ws.addEventListener('open', async () => {
      try {
        await send('Page.enable');
        await send('Runtime.enable');
        await send('Page.navigate', { url });
        await new Promise(r => setTimeout(r, settleMs));
        // 探针修复：面板在宿主 shell 内点击侧栏「科灵台」入口后才 mount；裸导航只有 style 无 rd-root。
        await send('Runtime.evaluate', { expression: "(function(){var es=[].slice.call(document.querySelectorAll('*')).filter(function(e){return (e.textContent||'').trim()==='科灵台'});if(!es.length)return;var t=es[es.length-1];for(var i=0;i<5&&t;i++){if(t.click){t.click();break}t=t.parentElement}})()", returnByValue: true });
        await new Promise(r => setTimeout(r, 1500));
        const res = await send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        const value = res && res.result && res.result.result && res.result.result.value;
        clearTimeout(timer);
        done(typeof value === 'string' ? value : '');
      } catch (err) {
        clearTimeout(timer);
        done('');
      }
    });
    ws.addEventListener('error', () => { clearTimeout(timer); done(''); });
  });
}

// 反复试一个 fn，直到它给出真值或超时。
async function waitFor(fn, timeoutMs) {
  const started = Date.now();
  for (;;) {
    let value = null;
    try { value = await fn(); } catch (err) { value = null; }
    if (value) return value;
    if (Date.now() - started > timeoutMs) return null;
    await new Promise(r => setTimeout(r, 400));
  }
}

// 找一个没人占用的本地端口（从 start 起顺延）。
async function freePort(start) {
  for (let p = start; p < start + 200; p++) {
    if (!(await portBusy(p))) return p;
  }
  return start;
}

function mcpProbe() {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [join(ROOT, 'bin', 'dsh-research-desk-mcp.mjs')], { stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '';
    const replies = [];
    let settled = false;
    const finish = payload => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child.kill(); } catch (err) { /* 已经退了 */ }
      resolve(payload);
    };
    const timer = setTimeout(() => finish({ ok: false, detail: 'MCP 30s 没有回应' }), 30000);
    const summarize = () => {
      const init = replies.find(r => r.id === 1);
      const list = replies.find(r => r.id === 2);
      const info = init && init.result && init.result.serverInfo ? init.result.serverInfo : {};
      const tools = (list && list.result && list.result.tools) || [];
      return {
        ok: !!(init && init.result && list && tools.length >= 5),
        detail: 'server=' + (info.name || '?') + ' version=' + (info.version || '?') + ' tools=' + tools.length,
      };
    };
    child.stdout.on('data', d => {
      buf += d;
      let idx = buf.indexOf('\n');
      while (idx >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (line) { try { replies.push(JSON.parse(line)); } catch (err) { /* 不是 JSON 行，忽略 */ } }
        idx = buf.indexOf('\n');
      }
      // stdio 服务不会自己退出，所以拿到两条回复就收工，别等 close。
      if (replies.some(r => r.id === 1) && replies.some(r => r.id === 2)) finish(summarize());
    });
    child.on('error', err => finish({ ok: false, detail: String(err && err.message) }));
    child.on('close', () => finish(summarize()));
    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'acceptance', version: '1' } },
    }) + '\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    setTimeout(() => {
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
    }, 500);
  });
}

function backupState() {
  if (!existsSync(STATE_FILE)) return null;
  const dir = mkdtempSync(join(tmpdir(), 'rd-state-'));
  const copy = join(dir, 'state.json');
  try {
    copyFileSync(STATE_FILE, copy);
    return { dir, copy };
  } catch (err) {
    return null;
  }
}

function restoreState(backup) {
  if (!backup) return;
  try {
    copyFileSync(backup.copy, STATE_FILE);
    rmSync(backup.dir, { recursive: true, force: true });
    console.log('已还原文献库：' + STATE_FILE);
  } catch (err) {
    console.log('还原文献库失败：' + (err && err.message));
  }
}

// ── A 组：环境与安装 ───────────────────────────────────────────────────────
async function phaseA() {
  section('A 环境与安装');
  check('A1 宿主 exe 存在', existsSync(HARNESS_EXE), HARNESS_EXE);
  const cliFound = existsSync(CLI_JS) || existsSync('D:/opt/DeepSeek Harness/resources/runtime/cli/bin/dsh.cmd');
  check('A2 宿主 cli 入口存在', cliFound, CLI_JS);
  const profileDir = join(HOME, 'profiles', PROFILE);
  check('A3 profile 目录存在', existsSync(profileDir), profileDir);
  const installed = join(profileDir, 'node_modules', 'dsh-research-desk');
  if (!existsSync(installed)) {
    console.log('    profile 里没有插件，正在本地联调安装：dsh plugin --profile ' + PROFILE + ' add link:' + ROOT);
    const r = await runCli(['plugin', '--profile', PROFILE, 'add', 'link:' + ROOT], 300000);
    check('A4 插件安装到 profile', existsSync(installed), (r.out + r.err).slice(-200));
  } else {
    check('A4 插件已在 profile 里', true, installed);
  }
}

// ── B 组：宿主路由与非模型动作 ─────────────────────────────────────────────
async function phaseB(base) {
  section('B 宿主路由与非模型动作');

  const status = await post(base, { action: 'status' }, server && server.token);
  check('B1 status 动作', status.json && status.json.ok === true, (status.json && status.json.message || status.text).slice(0, 90));

  const models = await post(base, { action: 'models' }, server && server.token);
  const modelRows = (models.json && models.json.models) || [];
  check('B2 models 动作（宿主 listModels 是异步的）', models.json && models.json.ok === true && modelRows.length > 0, modelRows.length + ' 个：' + modelRows.map(r => r.provider + '/' + r.model).slice(0, 3).join('、'));

  const settings = await post(base, { action: 'settings' }, server && server.token);
  const rows = (settings.json && settings.json.rows) || [];
  check('B3 settings 视图覆盖全部声明项', rows.length === SETTING_DEFS.length, rows.length + ' / ' + SETTING_DEFS.length);
  const secretRows = rows.filter(r => r.secret);
  const leaked = secretRows.filter(r => r.value && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(r.value)));
  check('B4 密钥只暴露环境变量名', leaked.length === 0, secretRows.map(r => r.key + '=' + r.value).join('、'));

  const searchRes = await post(base, { action: 'search', query: 'retrieval augmented generation evaluation', maxResults: 6 }, server && server.token);
  const papers = (searchRes.json && searchRes.json.papers) || [];
  check('B5 检索有结果', papers.length > 0, papers.length + ' 篇' + ((searchRes.json && searchRes.json.errors || []).length ? '，部分源失败' : ''));
  if (!papers.length) return { papers: [], modelRows };

  const addRes = await post(base, { action: 'add', papers }, server && server.token);
  check('B6 文献入库', addRes.json && addRes.json.ok === true && addRes.json.count > 0, (addRes.json && addRes.json.message || '').slice(0, 90));

  const lib = await post(base, { action: 'library' }, server && server.token);
  const libPapers = (lib.json && lib.json.library && lib.json.library.papers) || [];
  check('B7 文献库可列出', libPapers.length > 0, libPapers.length + ' 篇');

  let chunked = 0;
  for (const paper of libPapers.slice(0, 3)) {
    const readRes = await post(base, { action: 'read', paperId: paper.id }, server && server.token);
    if (readRes.json && readRes.json.ok && readRes.json.chunks > 0) chunked++;
  }
  check('B8 read 入库全文（至少一篇）', chunked > 0, chunked + ' 篇有段落');

  return { papers, libPapers, modelRows };
}

// ── C 组：四条模型路径 ─────────────────────────────────────────────────────
async function pickRoute(base, modelRows) {
  const candidates = [];
  if (FORCED_MODEL) candidates.push(FORCED_MODEL);
  const current = await post(base, { action: 'settings' }, server && server.token);
  const cur = (current.json && current.json.settings && current.json.settings['model.route']) || '';
  if (cur && !candidates.includes(cur)) candidates.push(cur);
  for (const row of modelRows) candidates.push(row.provider + '/' + row.model);
  for (const route of candidates) {
    const patched = await post(base, { action: 'settings', patch: { 'model.route': route } }, server && server.token);
    if (!patched.json || !patched.json.ok) continue;
    const probe = await post(base, { action: 'ask', question: 'What is retrieval augmented generation?' }, server && server.token);
    const message = String((probe.json && probe.json.message) || '');
    if (!probe.json || probe.json.ok === false) {
      console.log('    这条路由不可用，跳过：' + route + '（' + message.slice(0, 60) + '）');
      continue;
    }
    return route;
  }
  return null;
}

async function phaseC(base, modelRows) {
  section('C 四条模型路径');
  if (SKIP_MODEL) {
    for (const name of ['C1 ask', 'C2 review', 'C3 hypothesis', 'C4 draft']) skip(name, '--skip-model');
    check('C0 有可用模型路由', false, '--skip-model 未验证');
    return;
  }
  const route = await pickRoute(base, modelRows);
  if (route) check('C0 有可用模型路由', true, route);
  if (!route) {
    check('C0 有可用模型路由', false, '没有可用路由，C1-C4 未验证');
    for (const name of ['C1 ask', 'C2 review', 'C3 hypothesis', 'C4 draft']) skip(name, '没有可用路由');
    return;
  }

  const ask = await post(base, { action: 'ask', question: 'How does faithfulness evaluation work for retrieval augmented generation?' }, server && server.token);
  const askJson = ask.json || {};
  check('C1 ask 检索式问答', askJson.ok === true && Array.isArray(askJson.hits) && askJson.hits.length > 0, (askJson.hits || []).length + ' 个命中 · ' + String(askJson.message || '').slice(0, 60));

  const review = await post(base, { action: 'review', topic: 'faithfulness evaluation for RAG', perspectives: ['methodology', 'evidence'] }, server && server.token);
  const reviewJson = review.json || {};
  const sections = (reviewJson.review && reviewJson.review.sections) || [];
  const cites = sections.reduce((sum, s) => sum + ((s.citations || []).length), 0);
  check('C2 review 多视角综述', reviewJson.ok === true && sections.length > 0 && sections.every(s => s.text), sections.length + ' 段 · ' + cites + ' 条已核验引文');

  const hypo = await post(base, { action: 'hypothesis' }, server && server.token);
  const hypoJson = hypo.json || {};
  const hypos = (hypoJson.library && hypoJson.library.hypotheses) || [];
  check('C3 hypothesis 选题落库', hypoJson.ok === true && hypos.length > 0, hypos.length + ' 条选题');

  const draft = await post(base, { action: 'draft', instruction: 'Write a short outline about evaluation metrics for retrieval augmented generation.' }, server && server.token);
  const draftJson = draft.json || {};
  const drafts = (draftJson.library && draftJson.library.drafts) || [];
  const body = drafts.length ? String(drafts[drafts.length - 1].body || '') : '';
  check('C4 draft 草稿落库', draftJson.ok === true && body.length > 0, (drafts.length ? body.length + ' 字符' : (draftJson.message || '').slice(0, 60)));
}

// ── D 组：侧栏渲染、导出、外部工具闸门、MCP ───────────────────────────────
async function phaseD(base) {
  section('D 侧栏面板与周边能力');

  const dom = await dumpDom(server.url);
  const hasLabel = dom.includes('科灵台');
  const hasRoot = dom.includes('rd-root');
  const hasStyle = dom.includes('data-rd=');
  check('D1 侧栏出现「科灵台」入口', hasLabel, dom.length + ' 字节 DOM');
  check('D2 面板根节点已挂载', hasRoot && hasStyle, 'rd-root=' + hasRoot + ' style=' + hasStyle);

  const exportRes = await post(base, { action: 'export', formats: ['md', 'bib', 'json'] }, server && server.token);
  const files = (exportRes.json && exportRes.json.files) || [];
  const jsonFile = files.find(f => f.format === 'json');
  let secretLeak = false;
  if (jsonFile) {
    try {
      const parsed = JSON.parse(jsonFile.content);
      const exported = parsed.settings || {};
      for (const key of Object.keys(exported)) {
        if (!key.startsWith('secrets.')) continue;
        const v = exported[key];
        if (v && typeof v === 'object' && 'configured' in v) continue;
        secretLeak = true;
      }
    } catch (err) { secretLeak = true; }
  }
  check('D3 导出三种格式且不含密钥', files.length === 3 && !secretLeak, files.map(f => f.format).join('/'));

  const gate = await post(base, { action: 'run', runtime: 'node', code: 'console.log(1+1)' }, server && server.token);
  check('D4 未开外部工具时拒绝执行', gate.json && gate.json.ok === false, (gate.json && gate.json.message || '').slice(0, 70));

  const enable = await post(base, { action: 'settings', patch: { 'runner.enabled': true } }, server && server.token);
  check('D5 打开外部工具开关', enable.json && enable.json.ok === true, 'runner.enabled=true');
  const runRes = await post(base, { action: 'run', title: '验收：打印 2', runtime: 'node', code: 'console.log(2+2)' }, server && server.token);
  const stdout = String((runRes.json && runRes.json.experiment && runRes.json.experiment.stdout) || '');
  check('D6 真跑 Node 代码', runRes.json && runRes.json.ok === true && stdout.includes('4'), stdout.trim() || (runRes.json && runRes.json.message || '').slice(0, 60));
  await post(base, { action: 'settings', patch: { 'runner.enabled': false } }, server && server.token);

  const mcp = await mcpProbe();
  check('D7 MCP stdio 入口', mcp.ok, mcp.detail);
}

// ── 驱动 ───────────────────────────────────────────────────────────────────
async function main() {
  const started = Date.now();
  console.log('dsh-research-desk 真机验收');
  console.log('宿主 exe   : ' + HARNESS_EXE);
  console.log('profile    : ' + PROFILE);
  console.log('只跑分组   : ' + (ONLY ? ONLY.join(',') : '全部'));
  if (SKIP_MODEL) console.log('模型四段   : 跳过（--skip-model）');

  if (!KEEP_STATE) stateBackup = backupState();

  if (wanted('A')) await phaseA();

  const port = await pickPort(PORT_BASE);
  console.log('实例端口   : ' + port);
  try {
    server = await bootServer(port);
  } catch (err) {
    console.log('实例没起来：' + (err && err.message));
    if (!KEEP_STATE) restoreState(stateBackup);
    process.exitCode = 1;
    return;
  }
  console.log('实例地址   : ' + server.url);
  console.log('');
  console.log('（下面的输出是宿主的启动日志，只看有没有报错即可）');

  let ctx = { papers: [], libPapers: [], modelRows: [] };
  try {
    if (wanted('B')) ctx = await phaseB(server.base);
    if (wanted('C')) await phaseC(server.base, ctx.modelRows);
    if (wanted('D')) await phaseD(server.base);
  } catch (err) {
    console.log('验收过程中抛错：' + (err && err.stack ? err.stack : String(err)));
    failures++;
  }

  if (!KEEP_SERVER) {
    try { server.child.kill(); } catch (err) { /* 已经退了 */ }
    console.log('实例已关闭');
  } else {
    console.log('实例仍在运行：' + server.url);
  }
  if (!KEEP_STATE) restoreState(stateBackup);

  const passed = results.filter(r => r.ok === true && !r.skipped).length;
  console.log('');
  console.log('─────────────────────────────');
  console.log('通过 ' + passed + ' · 失败 ' + failures + ' · 跳过 ' + skips + ' · 用时 ' + Math.round((Date.now() - started) / 1000) + 's');
  const failed = results.filter(r => !r.ok && !r.skipped);
  if (failed.length) {
    console.log('失败项：');
    for (const row of failed) console.log('  - ' + row.name + (row.detail ? '  |  ' + row.detail : ''));
  }
  process.exitCode = failures ? 1 : 0;
}

main().catch(err => {
  console.log('验收脚本崩了：' + (err && err.stack ? err.stack : String(err)));
  if (server) { try { server.child.kill(); } catch (e) { /* ignore */ } }
  if (!KEEP_STATE) restoreState(stateBackup);
  process.exitCode = 1;
});