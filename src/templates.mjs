// HTML 骨架。所有页面共用 layout()，各页面只负责填中间那块。

export function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const url = (cfg, p) => cfg.base + String(p).replace(/^\//, '');

function navBar(cfg, current) {
  return cfg.nav
    .map((n) => {
      const active = n.href === current ? ' aria-current="page"' : '';
      return `<a href="${url(cfg, n.href)}"${active}>${escapeHtml(n.label)}</a>`;
    })
    .join('\n        ');
}

export function layout(cfg, { title, description, body, current = '', head = '' }) {
  const full = title ? `${title} · ${cfg.title}` : `${cfg.title} · ${cfg.tagline}`;
  return `<!DOCTYPE html>
<html lang="${cfg.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(full)}</title>
<meta name="description" content="${escapeHtml(description || cfg.description)}">
<meta property="og:title" content="${escapeHtml(full)}">
<meta property="og:description" content="${escapeHtml(description || cfg.description)}">
<meta property="og:type" content="website">
<link rel="icon" href="${url(cfg, cfg.avatar)}">
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(cfg.title)}" href="${url(cfg, 'feed.xml')}">
<link rel="stylesheet" href="${url(cfg, 'style.css')}">
${head}
</head>
<body>
<header class="site-header">
  <div class="header-inner">
    <a class="brand" href="${url(cfg, '/')}">
      <img src="${url(cfg, cfg.avatar)}" alt="avatar" width="44" height="44">
      <span class="brand-text">
        <span class="brand-title">${escapeHtml(cfg.title)}</span>
        <span class="brand-tagline">${escapeHtml(cfg.tagline)}</span>
      </span>
    </a>
    <nav class="nav">
        ${navBar(cfg, current)}
    </nav>
  </div>
</header>

<main class="wrap">
${body}
</main>

<footer class="site-footer">
  <div class="wrap">
    <span>&copy; ${new Date().getFullYear()} ${escapeHtml(cfg.author)}</span>
    <span>markdown &rarr; html &middot; git push &rarr; live</span>
  </div>
</footer>
</body>
</html>
`;
}

/* ---------------------------------------------------------------- 首页 */

export function homePage(cfg, posts, total) {
  const hero = `<section class="hero">
  <img src="${url(cfg, cfg.avatar)}" alt="avatar" width="72" height="72">
  <p>${escapeHtml(cfg.description)}</p>
</section>`;

  const list = posts.length
    ? `<ul class="post-list">\n${posts.map((p) => postCard(cfg, p)).join('\n')}\n</ul>`
    : `<p class="empty">还没有文章。往 <code>posts/</code> 里丢一个 .md 吧。</p>`;

  const more =
    total > posts.length
      ? `<p><a class="btn" href="${url(cfg, '/archive/')}">全部 ${total} 篇 →</a></p>`
      : '';

  return hero + `<h1 class="section-title">Latest Posts</h1>` + list + more;
}

export function postCard(cfg, p) {
  const tags = (p.tags || [])
    .map((t) => `<a class="tag" href="${url(cfg, '/tags/')}#${encodeURIComponent(t)}">${escapeHtml(t)}<span class="tag-count"></span></a>`)
    .join(' ');
  return `<li class="post-card">
  <div class="post-meta"><time datetime="${p.date}">${p.date}</time><span>·</span><span>${p.readingTime} MIN</span></div>
  <h2><a href="${url(cfg, p.permalink)}">${escapeHtml(p.title)}</a></h2>
  ${p.summary ? `<p class="post-summary">${escapeHtml(p.summary)}</p>` : ''}
  ${tags ? `<p class="tag-cloud" style="margin:0.7rem 0 0">${tags}</p>` : ''}
</li>`;
}

/* -------------------------------------------------------------- 文章页 */

export function postPage(cfg, p, prev, next) {
  const tags = (p.tags || [])
    .map((t) => `<a class="tag" href="${url(cfg, '/tags/')}#${encodeURIComponent(t)}">${escapeHtml(t)}</a>`)
    .join(' ');

  const navLinks = [];
  if (prev) navLinks.push(`<a href="${url(cfg, prev.permalink)}">← ${escapeHtml(prev.title)}</a>`);
  else navLinks.push('<span></span>');
  if (next) navLinks.push(`<a href="${url(cfg, next.permalink)}">${escapeHtml(next.title)} →</a>`);

  return `<article>
  <header class="article-header">
    <h1 class="article-title">${escapeHtml(p.title)}</h1>
    <div class="article-meta">
      <time datetime="${p.date}">${p.date}</time>
      <span>·</span><span>${p.readingTime} MIN READ</span>
      ${p.tags?.length ? `<span>·</span>${tags}` : ''}
    </div>
  </header>
  <div class="prose">${p.html}</div>
  <div class="post-nav">
    ${navLinks.join('\n    ')}
  </div>
  <p style="margin-top:2rem"><a class="btn" href="${url(cfg, '/archive/')}">← 回到归档</a></p>
</article>`;
}

/* -------------------------------------------------------------- 归档页 */

export function archivePage(cfg, posts) {
  if (!posts.length) return `<h1 class="section-title">Archive</h1><p class="empty">空空如也。</p>`;
  const groups = new Map();
  posts.forEach((p) => {
    const y = p.date.slice(0, 4);
    if (!groups.has(y)) groups.set(y, []);
    groups.get(y).push(p);
  });
  const body = [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(
      ([year, list]) => `<div class="year-group">
  <h2 class="year-label">${year}</h2>
  ${list
    .map(
      (p) => `<div class="archive-item">
    <time datetime="${p.date}">${p.date.slice(5)}</time>
    <a href="${url(cfg, p.permalink)}">${escapeHtml(p.title)}</a>
  </div>`
    )
    .join('\n  ')}
</div>`
    )
    .join('\n');
  return `<h1 class="section-title">Archive · ${posts.length} 篇</h1>\n${body}`;
}

/* -------------------------------------------------------------- 标签页 */

export function tagsPage(cfg, posts) {
  const map = new Map();
  posts.forEach((p) => (p.tags || []).forEach((t) => {
    if (!map.has(t)) map.set(t, []);
    map.get(t).push(p);
  }));
  if (!map.size) return `<h1 class="section-title">Tags</h1><p class="empty">还没有标签。</p>`;

  const cloud = [...map.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([t, list]) => `<a class="tag" href="#${encodeURIComponent(t)}">${escapeHtml(t)}<span class="tag-count"> ${list.length}</span></a>`)
    .join('\n');

  const groups = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'zh'))
    .map(
      ([t, list]) => `<div class="tag-group" id="${encodeURIComponent(t)}">
  <h2># ${escapeHtml(t)} <span class="tag-count">(${list.length})</span></h2>
  ${list
    .map(
      (p) => `<div class="archive-item">
    <time datetime="${p.date}">${p.date}</time>
    <a href="${url(cfg, p.permalink)}">${escapeHtml(p.title)}</a>
  </div>`
    )
    .join('\n  ')}
</div>`
    )
    .join('\n');

  return `<h1 class="section-title">Tags</h1>\n<nav class="tag-cloud">\n${cloud}\n</nav>\n${groups}`;
}

/* --------------------------------------------------------------- 404 */

export function notFoundPage(cfg) {
  return `<div class="notfound">
  <p class="big">404</p>
  <p>这页不存在。也许是删除了，也许从没写过。</p>
  <p><a class="btn" href="${url(cfg, '/')}">回首页</a></p>
</div>`;
}

/* --------------------------------------------------------------- RSS */

export function feedXml(cfg, posts) {
  const items = posts
    .slice(0, 30)
    .map((p) => {
      const link = new URL(url(cfg, p.permalink).replace(/^\//, '/'), cfg.url).href;
      return `    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(p.date + 'T00:00:00Z').toUTCString()}</pubDate>
      ${(p.tags || []).map((t) => `<category>${escapeHtml(t)}</category>`).join('\n      ')}
      <description>${escapeHtml(p.summary || '')}</description>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(cfg.title)}</title>
    <link>${cfg.url}/</link>
    <description>${escapeHtml(cfg.description)}</description>
    <language>${cfg.lang}</language>
    <atom:link href="${cfg.url}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}
