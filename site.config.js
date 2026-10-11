// 站点配置 —— 改这里，然后 npm run build
export default {
  // 站点信息
  title: 'HAPPYsalt',
  tagline: '学习 运动 生活',
  author: '乐延',
  description: '静态个人博客，记录生活和想法',

  // GitHub Pages 地址（RSS 里用，末尾不要带斜杠）
  url: 'https://theslycat.github.io',
  // 站点根路径。仓库名是 <用户名>.github.io 时保持 '/'
  base: '/',
  lang: 'zh-CN',

  // 构建产物目录。GitHub Pages 用 "Deploy from branch" 时只能选根目录或 /docs，
  // 所以这里默认 docs/ —— 一个分支搞定，push 即发布。
  outDir: 'docs',

  // 头像（放在 src/ 下，构建时会复制到站点根）
  avatar: '/avatar.svg',

  // 导航栏
  nav: [
    { label: 'BLOG', href: '/' },
    { label: 'ARCHIVE', href: '/archive/' },
    { label: 'TAGS', href: '/tags/' },
    { label: 'ABOUT', href: '/about/' },
    { label: 'RSS', href: '/feed.xml' },
  ],

  // 首页显示的最新文章数量，其余去归档页
  homeCount: 10,
};
