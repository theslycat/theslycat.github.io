// 下载字体到本地自托管，避免国内访问 fonts.gstatic.com / CDN 不稳定。
// 用法：npm run fonts
// 产物：src/fonts/*.woff2  +  src/styles/fonts.css
//
// 换字体就改下面的 SOURCES：
//   { google: ['字体名', ...] }              从 Google Fonts 拉
//   { css: 'https://.../xxx.css' }           从任意 CSS 拉（支持相对 url）

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONT_DIR = path.join(ROOT, 'src', 'fonts');
const CSS_OUT = path.join(ROOT, 'src', 'styles', 'fonts.css');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const LXGW_VERSION = '1.7.0';

const SOURCES = [
  // 英文 / UI：经典 8-bit 像素
  { google: ['Press Start 2P'] },
  // 中文标题：站酷庆科黄油体（圆润、有卡通感）
  { google: ['ZCOOL QingKe HuangYou'] },
  // 中文正文：霞鹜文楷 Regular（https://github.com/lxgw/LxgwWenKai）
  { css: `https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@${LXGW_VERSION}/lxgwwenkai-regular.css` },
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`请求失败 ${res.status}: ${url}`);
  return res.text();
}

async function fetchBinary(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`下载失败 ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const cssUrlFor = (src) =>
  src.google
    ? `https://fonts.googleapis.com/css2?${src.google
        .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}`)
        .join('&')}&display=swap`
    : src.css;

// 每次全量重下：先清空，避免换字体后留下没用的旧分片
await fs.rm(FONT_DIR, { recursive: true, force: true });
await fs.mkdir(FONT_DIR, { recursive: true });

const out = [];
let total = 0;
let index = 0;

for (const src of SOURCES) {
  const cssUrl = cssUrlFor(src);
  const css = await fetchText(cssUrl);
  const blocks = css.split('@font-face').slice(1);
  console.log(`→ ${cssUrl}\n   ${blocks.length} 个 @font-face 分片`);

  for (const block of blocks) {
    const family = (block.match(/font-family:\s*'([^']+)'/) || [])[1];
    const style = (block.match(/font-style:\s*([^;]+);/) || [, 'normal'])[1].trim();
    const weight = (block.match(/font-weight:\s*([^;]+);/) || [, '400'])[1].trim();
    const rawUrl = (block.match(/url\(['"]?([^'")]+\.woff2)['"]?\)/) || [])[1];
    const unicodeRange = (block.match(/unicode-range:\s*([^;]+);/) || [])[1];
    if (!family || !rawUrl) continue;

    const absUrl = new URL(rawUrl, cssUrl).href;
    const file = `${slug(family)}-${String(++index).padStart(3, '0')}.woff2`;
    const buf = await fetchBinary(absUrl);
    await fs.writeFile(path.join(FONT_DIR, file), buf);
    total += buf.length;

    const decl = [
      `  font-family: '${family}';`,
      `  font-style: ${style};`,
      `  font-weight: ${weight};`,
      `  font-display: swap;`,
      `  src: url('/fonts/${file}') format('woff2');`,
    ];
    if (unicodeRange) decl.push(`  unicode-range: ${unicodeRange.trim()};`);
    out.push(`@font-face {\n${decl.join('\n')}\n}`);
  }
}

const header =
  '/* 自动生成，请勿手改 —— 运行 npm run fonts 重新拉取\n' +
  ` * 共 ${out.length} 个分片，${(total / 1024 / 1024).toFixed(2)} MB\n` +
  ' * 正文中文：LXGW WenKai Regular（霞鹜文楷）\n' +
  ' * 中文标题：ZCOOL QingKe HuangYou · 英文/UI：Press Start 2P\n */\n\n';

await fs.writeFile(CSS_OUT, header + out.join('\n\n') + '\n');
console.log(`✓ ${out.length} 个分片 → src/fonts/，共 ${(total / 1024 / 1024).toFixed(2)} MB`);
console.log('✓ src/styles/fonts.css 已更新');
