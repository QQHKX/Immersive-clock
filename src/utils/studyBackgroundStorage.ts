import { getAppSettings, updateAppSettings } from "./appSettings";

export type StudyBackgroundType = "default" | "color" | "image";

export interface StudyBackgroundSettings {
  type: StudyBackgroundType;
  color?: string;
  /** 颜色透明度（0-1，仅当type=color有效） */
  colorAlpha?: number;
  imageDataUrl?: string;
}

function isValidHexColor(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}

export function readStudyBackground(): StudyBackgroundSettings {
  return getAppSettings().study.background;
}

export function saveStudyBackground(settings: StudyBackgroundSettings): void {
  const type = settings.type ?? "default";
  
  // Clean up incompatible fields logic can be done here or just save as is.
  // To match previous behavior of "cleaning up":
  const newBackground: StudyBackgroundSettings = { type };

  if (type === "color" && settings.color && isValidHexColor(settings.color)) {
    newBackground.color = settings.color;
    newBackground.colorAlpha = typeof settings.colorAlpha === "number"
        ? Math.max(0, Math.min(1, settings.colorAlpha))
        : 1;
  } else if (type === "image" && settings.imageDataUrl) {
    newBackground.imageDataUrl = settings.imageDataUrl;
  }

  updateAppSettings(current => ({
    study: {
      ...current.study,
      background: newBackground
    }
  }));
}

export function resetStudyBackground(): void {
  updateAppSettings(current => ({
    study: {
      ...current.study,
      background: { type: "default" }
    }
  }));
}

