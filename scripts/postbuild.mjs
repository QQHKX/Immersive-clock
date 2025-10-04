import fs from 'fs';
import path from 'path';

// 格式化日期为中文：YYYY年MM月DD日
function formatDateZh(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}年${m}月${d}日`;
}

function updateSitemapHtml(html) {
  const todayZh = formatDateZh(new Date());
  const pattern = /(最后更新:\s*)(\d{4}年\d{1,2}月\d{1,2}日)/;
  if (pattern.test(html)) {
    return html.replace(pattern, `$1${todayZh}`);
  }
  // 若未检测到日期行，则在文末追加一行
  const insertMarker = '</body>';
  if (html.includes(insertMarker)) {
    return html.replace(
      insertMarker,
      `  <p>最后更新: ${todayZh}</p>\n${insertMarker}`
    );
  }
  return html;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function main() {
  const root = process.cwd();
  const distDir = path.join(root, 'dist');
  ensureDir(distDir);

  // 处理 sitemap.html
  const sitemapHtmlPath = path.join(root, 'sitemap.html');
  if (fs.existsSync(sitemapHtmlPath)) {
    try {
      const html = fs.readFileSync(sitemapHtmlPath, 'utf-8');
      const updated = updateSitemapHtml(html);
      const outHtmlPath = path.join(distDir, 'sitemap.html');
      fs.writeFileSync(outHtmlPath, updated, 'utf-8');
      console.log(`[postbuild] sitemap.html 已更新日期并复制到: ${outHtmlPath}`);
    } catch (e) {
      console.error('[postbuild] 处理 sitemap.html 失败:', e);
    }
  } else {
    console.warn('[postbuild] 未找到 sitemap.html，跳过处理');
  }

  // 可选：复制 sitemap.xml 到 dist（不修改内容）
  const sitemapXmlPath = path.join(root, 'sitemap.xml');
  if (fs.existsSync(sitemapXmlPath)) {
    try {
      const outXmlPath = path.join(distDir, 'sitemap.xml');
      fs.copyFileSync(sitemapXmlPath, outXmlPath);
      console.log(`[postbuild] sitemap.xml 已复制到: ${outXmlPath}`);
    } catch (e) {
      console.error('[postbuild] 复制 sitemap.xml 失败:', e);
    }
  }

  // 可选：复制 robots.txt 到 dist，确保搜索引擎可读取
  const robotsPath = path.join(root, 'robots.txt');
  if (fs.existsSync(robotsPath)) {
    try {
      const outRobotsPath = path.join(distDir, 'robots.txt');
      fs.copyFileSync(robotsPath, outRobotsPath);
      console.log(`[postbuild] robots.txt 已复制到: ${outRobotsPath}`);
    } catch (e) {
      console.error('[postbuild] 复制 robots.txt 失败:', e);
    }
  }
}

main();