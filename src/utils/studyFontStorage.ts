import { db } from "./db";

/**
 * 学习页面字体存储与注入工具
 * 提供导入TTF/OTF/WOFF/WOFF2字体文件，持久化到本地(IndexedDB)，并将其以 @font-face 形式注入页面
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
 * 迁移旧数据到 IndexedDB
 */
async function migrateFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const validFonts = parsed.filter(
        (f) =>
          typeof f?.id === "string" &&
          typeof f?.family === "string" &&
          typeof f?.dataUrl === "string"
      ) as ImportedFontMeta[];

      // 逐个写入 DB
      for (const font of validFonts) {
        // 避免重复写入（虽然 put 会覆盖，但没必要）
        const exists = await db.get(font.id);
        if (!exists) {
          await db.set(font.id, font);
        }
      }
    }
    // 迁移成功后移除旧数据
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Migration from LocalStorage failed:", e);
  }
}

/**
 * 读取已导入字体列表（从 IndexedDB 异步读取）
 */
export async function loadImportedFonts(): Promise<ImportedFontMeta[]> {
  try {
    return await db.getAll<ImportedFontMeta>();
  } catch (e) {
    console.error("Failed to load fonts from DB:", e);
    return [];
  }
}

/**
 * 根据文件名推断字体格式
 */
function inferFormatByFilename(name: string): ImportedFontMeta["format"] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".ttf")) return "truetype";
  if (lower.endsWith(".otf")) return "opentype";
  if (lower.endsWith(".woff2")) return "woff2";
  return "woff";
}

/**
 * 导入字体文件
 * @param file 字体文件（ttf/otf/woff/woff2）
 * @param family 自定义字体家族名
 */
export async function importFontFile(file: File, family: string): Promise<ImportedFontMeta> {
  const fmt = inferFormatByFilename(file.name);
  const id = `font_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 检查文件大小，IndexedDB 容量较大，但仍建议限制（例如 50MB）
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("文件过大（超过 50MB），无法导入");
  }

  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });

  const meta: ImportedFontMeta = { id, family, dataUrl, format: fmt };

  try {
    await db.set(id, meta);
    // 触发更新
    window.dispatchEvent(new CustomEvent("study-fonts-updated"));

    // 立即刷新注入
    const list = await loadImportedFonts();
    injectFontFaces(list);

    return meta;
  } catch (e) {
    console.error("Failed to save font to DB:", e);
    throw new Error("导入失败，可能是存储空间不足");
  }
}

/**
 * 注入 @font-face 样式
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
 * 确保已注入字体（异步）
 * 包含自动迁移逻辑
 */
export async function ensureInjectedFonts(): Promise<number> {
  if (typeof document === "undefined") return 0;

  // 尝试迁移旧数据
  if (localStorage.getItem(STORAGE_KEY)) {
    await migrateFromLocalStorage();
  }

  const list = await loadImportedFonts();
  injectFontFaces(list);
  return list.length;
}

/**
 * 删除导入字体（异步）
 */
export async function removeImportedFont(id: string) {
  try {
    await db.del(id);
    const next = await loadImportedFonts();
    injectFontFaces(next);
    window.dispatchEvent(new CustomEvent("study-fonts-updated"));
  } catch (e) {
    console.error("Failed to remove font:", e);
  }
}
