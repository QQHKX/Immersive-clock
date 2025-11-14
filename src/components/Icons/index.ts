/**
 * 统一图标组件系统
 * 全部图标以 SVG 文件形式引入与导出
 */

// 基础图标组件已移除，统一使用 SVG 文件引用方式

// 图标组件统一导出
// 所有图标组件统一以 SVG 文件形式导出

export interface IconProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  "aria-hidden"?: boolean;
  title?: string;
}

// 主要功能图标
export { ClockIcon } from "./ClockIcon";
export { CountdownIcon } from "./CountdownIcon";
export { StudyIcon } from "./StudyIcon";
export { WatchIcon } from "./WatchIcon";

// 控制图标
export { PlayIcon } from "./PlayIcon";
export { PauseIcon } from "./PauseIcon";
export { ResetIcon } from "./ResetIcon";
export { RefreshIcon } from "./RefreshIcon";

// 界面控制图标
export { CloseIcon } from "./CloseIcon";
export { MaximizeIcon } from "./MaximizeIcon";
export { MinimizeIcon } from "./MinimizeIcon";

// 操作图标
export { PlusIcon } from "./PlusIcon";
export { MinusIcon } from "./MinusIcon";
export { TrashIcon } from "./TrashIcon";
export { SaveIcon } from "./SaveIcon";

// 音量图标
export { VolumeIcon } from "./VolumeIcon";
export { VolumeMuteIcon } from "./VolumeMuteIcon";

// 其他图标
export { EditIcon } from "./EditIcon";
export { FileIcon } from "./FileIcon";
export { CheckIcon } from "./CheckIcon";
export { BookOpenIcon } from "./BookOpenIcon";
export { ToggleOnIcon } from "./ToggleOnIcon";
export { ToggleOffIcon } from "./ToggleOffIcon";
export { SettingsIcon } from "./SettingsIcon";
export { BellIcon } from "./BellIcon";
