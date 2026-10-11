// 静态站点生成：posts/*.md + pages/*.md + assets/ → outDir/
// 用法：
//   npm run build           构建正式站点
//   npm run build -- --drafts  连 draft: true 的文章一起构建

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import * as T from '../src/templates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = (await import('../site.config.js')).default;
const OUT = path.join(ROOT, cfg.outDir || 'docs');
const WITH_DRAFTS = process.argv.includes('--drafts');

/* ------------------------------------------------------------ markdown */

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
  highlight(code, lang) {
    const escaped = md.utils.escapeHtml(code);
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch {
        /* 落到下面 */
      }
    }
    return `<pre class="hljs"><code>${escaped}</code></pre>`;
  },
});

// 图片：非视频走 <img>，视频后缀自动转 <video>
md.renderer.rules.image = (tokens, idx) => {
  const token = tokens[idx];
  const src = token.attrGet('src') || '';
  const alt = token.content || '';
  const title = token.attrGet('title') || '';
  const caption = title ? `<figcaption>${T.escapeHtml(title)}</figcaption>` : '';

  if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(src)) {
    return `<figure><video src="${src}" controls preload="metadata" playsinline></video>${caption}</figure>`;
  }
  const img = `<img src="${src}" alt="${T.escapeHtml(alt)}" loading="lazy" decoding="async">`;
  return title ? `<figure>${img}${caption}</figure>` : img;
};

// 站外链接新窗口打开
const defaultLinkOpen = md.renderer.rules.link_open ||
  ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
  const href = tokens[idx].attrGet('href') || '';
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
  }
  return defaultLinkOpen(tokens, idx, opts, env, self);
};

/**
 * 统一媒体路径：文章里写 `assets/x.png`、`../assets/x.png`、`/assets/x.png` 都指向 `/assets/x.png`
 * 裸文件名（x.png）也当作 assets 下的文件。站外 / data: / 锚点原样保留。
 */
function normalizeAssets(html) {
  return html.replace(/(src|href)="([^"]+)"/g, (all, attr, url) => {
    if (/^(https?:|data:|mailto:|tel:|#)/i.test(url)) return all;
    if (url.startsWith('/')) return all;
    let p = url.replace(/^\.\//, '');
    const i = p.indexOf('assets/');
    if (i >= 0) p = p.slice(i);
    else if (!p.includes('/')) p = `assets/${p}`;
    return `${attr}="/${p}"`;
  });
}

/* ------------------------------------------------------------ 文章读取 */

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('_')) out.push(full);
  }
  return out;
}

const fmtDate = (d) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

function parseDate(fm, filename, stat) {
  const raw = fm.date ?? fm.published ?? fm.created;
  if (raw) {
    if (raw instanceof Date) return fmtDate(raw);
    const m = String(raw).match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return fmtDate(d);
  }
  const m = path.basename(filename).match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return fmtDate(new Date(stat.mtime));
}

const stripTags = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function readingTime(text) {
  const cjk = (text.match(/[㐀-鿿぀-ヿ]/g) || []).length;
  const words = (text.match(/[A-Za-z0-9]+/g) || []).length;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
}

async function loadPosts(dir, prefix) {
  const files = await walk(dir);
  const posts = [];
  for (const file of files) {
    const stat = await fs.stat(file);
    const raw = await fs.readFile(file, 'utf8');
    const { data: fm, content } = matter(raw);
    if (fm.draft === true && !WITH_DRAFTS) continue;

    const rel = path.relative(dir, file);
    const base = path.basename(file, '.md');
    const slug =
      fm.slug ||
      base.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/[^a-zA-Z0-9\-_一-龥]/g, '-');
    const date = parseDate(fm, file, stat);
    const html = normalizeAssets(md.render(content));
    const plain = stripTags(html);
    const title =
      fm.title ||
      (content.match(/^#\s+(.+)$/m) || [])[1] ||
      base.replace(/^\d{4}-\d{2}-\d{2}-/, '');
    const summary = fm.summary ?? fm.description ?? plain.slice(0, 140);

    posts.push({
      title: String(title).trim(),
      date,
      tags: [].concat(fm.tags || fm.tag || []).map(String),
      summary: String(summary).trim(),
      html,
      readingTime: readingTime(plain),
      slug,
      permalink: `${prefix}${slug}/`,
      draft: fm.draft === true,
      source: path.relative(ROOT, file),
    });
  }
  return posts.sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? 1 : -1));
}

async function loadPages(dir) {
  const files = await walk(dir);
  const pages = [];
  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    const { data: fm, content } = matter(raw);
    const slug = fm.slug || path.basename(file, '.md');
    pages.push({
      title: fm.title || slug,
      description: fm.description || '',
      html: normalizeAssets(md.render(content)),
      permalink: `/${slug}/`,
      slug,
    });
  }
  return pages;
}

/* -------------------------------------------------------------- 输出 */

async function write(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

const page = (opts) => T.layout(cfg, opts);

/* -------------------------------------------------------------- 主流程 */

console.log('→ 清理输出目录');
await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

const posts = await loadPosts(path.join(ROOT, 'posts'), '/posts/');
const pages = await loadPages(path.join(ROOT, 'pages'));

console.log(`→ 构建 ${posts.length} 篇文章 / ${pages.length} 个页面`);

// 首页
await write(
  path.join(OUT, 'index.html'),
  page({
    title: '',
    current: '/',
    body: T.homePage(cfg, posts.slice(0, cfg.homeCount || 10), posts.length),
  })
);

// 文章页
for (let i = 0; i < posts.length; i++) {
  const p = posts[i];
  const prev = posts[i + 1]; // 更早的一篇
  const next = posts[i - 1]; // 更新的一篇
  await write(
    path.join(OUT, 'posts', p.slug, 'index.html'),
    page({
      title: p.title,
      description: p.summary,
      current: '/posts/',
      body: T.postPage(cfg, p, prev, next),
    })
  );
}

// 归档 / 标签
await write(path.join(OUT, 'archive', 'index.html'), page({ title: '归档', current: '/archive/', body: T.archivePage(cfg, posts) }));
await write(path.join(OUT, 'tags', 'index.html'), page({ title: '标签', current: '/tags/', body: T.tagsPage(cfg, posts) }));

// 独立页面
for (const p of pages) {
  await write(
    path.join(OUT, p.slug, 'index.html'),
    page({
      title: p.title,
      description: p.description,
      current: p.permalink,
      body: `<article><h1 class="article-title">${T.escapeHtml(p.title)}</h1><div class="prose">${p.html}</div></article>`,
    })
  );
}

// 404 / RSS / robots
await write(path.join(OUT, '404.html'), page({ title: '404', current: '', body: T.notFoundPage(cfg) }));
await write(path.join(OUT, 'feed.xml'), T.feedXml(cfg, posts));
await write(path.join(OUT, 'robots.txt'), 'User-agent: *\nAllow: /\n');

// CSS：字体声明 + 主样式合成一个文件
const cssDir = path.join(ROOT, 'src', 'styles');
let css = '';
try {
  css += await fs.readFile(path.join(cssDir, 'fonts.css'), 'utf8');
  css += '\n\n';
} catch {
  console.warn('  ! 未找到 src/styles/fonts.css，先跑 npm run fonts');
}
css += await fs.readFile(path.join(cssDir, 'main.css'), 'utf8');
await write(path.join(OUT, 'style.css'), css);

// 静态资源
await fs.cp(path.join(ROOT, 'assets'), path.join(OUT, 'assets'), { recursive: true, force: true });
await fs.cp(path.join(ROOT, 'src', 'fonts'), path.join(OUT, 'fonts'), { recursive: true, force: true });
try {
  await fs.cp(path.join(ROOT, 'src', 'avatar.svg'), path.join(OUT, 'avatar.svg'));
} catch {
  console.warn('  ! 未找到 src/avatar.svg');
}
await fs.writeFile(path.join(OUT, '.nojekyll'), '');

console.log(`✓ 完成 → ${path.relative(ROOT, OUT)}/`);
