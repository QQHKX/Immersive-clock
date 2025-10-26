export type StudyBackgroundType = 'default' | 'color' | 'image';

export interface StudyBackgroundSettings {
  type: StudyBackgroundType;
  color?: string;
  /** 颜色透明度（0-1，仅当type=color有效） */
  colorAlpha?: number;
  imageDataUrl?: string;
}

const TYPE_KEY = 'study-bg-type';
const COLOR_KEY = 'study-bg-color';
const COLOR_ALPHA_KEY = 'study-bg-color-alpha';
const IMAGE_KEY = 'study-bg-image';

function isValidHexColor(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}

export function readStudyBackground(): StudyBackgroundSettings {
  try {
    const type = (localStorage.getItem(TYPE_KEY) as StudyBackgroundType) || 'default';
    const color = localStorage.getItem(COLOR_KEY) || undefined;
    const colorAlphaRaw = localStorage.getItem(COLOR_ALPHA_KEY);
    const colorAlpha = colorAlphaRaw !== null ? Math.max(0, Math.min(1, parseFloat(colorAlphaRaw))) : 1;
    const imageDataUrl = localStorage.getItem(IMAGE_KEY) || undefined;

    if (type === 'color' && color && !isValidHexColor(color)) {
      // 非法颜色，回退默认
      return { type: 'default' };
    }

    return { type, color, colorAlpha, imageDataUrl };
  } catch {
    return { type: 'default' };
  }
}

export function saveStudyBackground(settings: StudyBackgroundSettings): void {
  const type = settings.type ?? 'default';
  localStorage.setItem(TYPE_KEY, type);

  if (type === 'color' && settings.color && isValidHexColor(settings.color)) {
    localStorage.setItem(COLOR_KEY, settings.color);
    localStorage.setItem(COLOR_ALPHA_KEY, (typeof settings.colorAlpha === 'number' ? Math.max(0, Math.min(1, settings.colorAlpha)) : 1).toString());
    localStorage.removeItem(IMAGE_KEY);
  } else if (type === 'image' && settings.imageDataUrl) {
    localStorage.setItem(IMAGE_KEY, settings.imageDataUrl);
    localStorage.removeItem(COLOR_KEY);
    localStorage.removeItem(COLOR_ALPHA_KEY);
  } else {
    // 默认：清除定制内容
    localStorage.removeItem(COLOR_KEY);
    localStorage.removeItem(COLOR_ALPHA_KEY);
    localStorage.removeItem(IMAGE_KEY);
  }
}

export function resetStudyBackground(): void {
  localStorage.setItem(TYPE_KEY, 'default');
  localStorage.removeItem(COLOR_KEY);
  localStorage.removeItem(COLOR_ALPHA_KEY);
  localStorage.removeItem(IMAGE_KEY);
}