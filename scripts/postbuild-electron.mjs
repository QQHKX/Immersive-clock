import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const distPath = path.join(__dirname, '../dist');

// 修改 fonts.css 中的路径
const fontsCssPath = path.join(distPath, 'fonts/fonts.css');
if (fs.existsSync(fontsCssPath)) {
  let content = fs.readFileSync(fontsCssPath, 'utf-8');
  // 将绝对路径转换为相对路径
  content = content.replace(/url\('\/fonts\//g, "url('./");
  content = content.replace(/url\("\/fonts\//g, 'url("./');
  fs.writeFileSync(fontsCssPath, content, 'utf-8');
  console.log('✓ Updated fonts.css paths for Electron');
}

// 修改 index.html 中的直接路径引用
const indexPath = path.join(distPath, 'index.html');
if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf-8');
  
  // 替换 href 和 src 中的绝对路径
  content = content.replace(/href="\/fonts\//g, 'href="./fonts/');
  content = content.replace(/href="\/icons\//g, 'href="./icons/');
  content = content.replace(/href="\/weather-icons\//g, 'href="./weather-icons/');
  content = content.replace(/src="\/fonts\//g, 'src="./fonts/');
  content = content.replace(/src="\/icons\//g, 'src="./icons/');
  
  fs.writeFileSync(indexPath, content, 'utf-8');
  console.log('✓ Updated index.html paths for Electron');
}



