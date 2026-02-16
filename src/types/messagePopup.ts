export type MessagePopupType =
  | "general"
  | "error"
  | "weatherAlert"
  | "weatherForecast"
  | "coolingReminder"
  | "systemUpdate";

export interface MessagePopupOpenDetail {
  id?: string;
  type?: MessagePopupType;
  title?: string;
  message?: unknown;
  themeColor?: string;
}
