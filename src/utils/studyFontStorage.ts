/**
 * 学习页面字体存储与注入工具
 * 提供导入TTF/OTF/WOFF/WOFF2字体文件，持久化到本地，并将其以 @font-face 形式注入页面
 */
export interface ImportedFontMeta {
  /** 唯一ID */
  id: string;
  /** 字体家族名（用于 font-family） */
  family: string;
  /** DataURL（Base64） */
  dataUrl: string;
  /** 字体格式 */
  format: "truetype" | "opentype" | "woff" | "woff2";
}

const STORAGE_KEY = "study-fonts";
const STYLE_EL_ID = "study-fonts-style";

/**
 * 读取已导入字体列表（函数级注释：从本地存储解析并返回字体元数据列表，格式错误时回退为空）
 */
export function loadImportedFonts(): ImportedFontMeta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (f) =>
          typeof f?.id === "string" &&
          typeof f?.family === "string" &&
          typeof f?.dataUrl === "string"
      );
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * 保存字体列表到本地存储（函数级注释：将字体元数据列表写入 localStorage）
 */
function saveImportedFonts(list: ImportedFontMeta[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/**
 * 根据文件名推断字体格式（函数级注释：从扩展名映射到 @font-face 的 format 值）
 */
function inferFormatByFilename(name: string): ImportedFontMeta["format"] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".ttf")) return "truetype";
  if (lower.endsWith(".otf")) return "opentype";
  if (lower.endsWith(".woff2")) return "woff2";
  return "woff";
}

/**
 * 导入字体文件（函数级注释：读取文件为DataURL并保存为自定义字体，返回新增的字体元数据）
 * @param file 字体文件（ttf/otf/woff/woff2）
 * @param family 自定义字体家族名
 */
export async function importFontFile(file: File, family: string): Promise<ImportedFontMeta> {
  const fmt = inferFormatByFilename(file.name);
  const id = `font_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
  const meta: ImportedFontMeta = { id, family, dataUrl, format: fmt };
  const list = loadImportedFonts();
  list.push(meta);
  saveImportedFonts(list);
  window.dispatchEvent(new CustomEvent("study-fonts-updated"));
  return meta;
}

/**
 * 注入 @font-face 样式（函数级注释：为每个导入字体生成 @font-face 并写入页面 <style>）
 */
export function injectFontFaces(fonts: ImportedFontMeta[]) {
  let el = document.getElementById(STYLE_EL_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_EL_ID;
    document.head.appendChild(el);
  }
  const css = fonts
    .map(
      (f) =>
        `@font-face{font-family:${JSON.stringify(f.family)};src:url(${f.dataUrl}) format('${f.format}');font-display:swap;}`
    )
    .join("\n");
  el.textContent = css;
}

/**
 * 确保已注入字体（函数级注释：从本地存储加载并注入字体，返回注入数量）
 */
export function ensureInjectedFonts(): number {
  const list = loadImportedFonts();
  if (typeof document !== "undefined") {
    injectFontFaces(list);
  }
  return list.length;
}

/**
 * 删除导入字体（函数级注释：按ID移除字体并更新样式）
 */
export function removeImportedFont(id: string) {
  const next = loadImportedFonts().filter((f) => f.id !== id);
  saveImportedFonts(next);
  injectFontFaces(next);
  window.dispatchEvent(new CustomEvent("study-fonts-updated"));
}
