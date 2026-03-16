import React from "react";

import styles from "./AuthorInfo.module.css";

interface AuthorInfoProps {
  /** 版本号点击回调函数 */
  onVersionClick?: () => void;
} /**
 * 作者信息组件
 * 显示应用的作者和版本信息
 * 自动读取package.json中的版本号
 * 支持版本号点击触发公告弹窗
 */
export function AuthorInfo({ onVersionClick }: AuthorInfoProps) {
  // 版本来自环境变量（vite.config 注入）
  const appVersion = import.meta.env.VITE_APP_VERSION;

  /**
   * 处理版本号点击事件
   */
  const handleVersionClick = () => {
    if (onVersionClick) {
      onVersionClick();
    }
  };

  return (
    <aside className={styles.authorInfo}>
      <div className={styles.version}>
        <button
          className={styles.action}
          onClick={handleVersionClick}
          title="点击查看公告"
          type="button"
          aria-label={`版本 v${appVersion}，点击查看更新公告`}
        >
          v{appVersion}
        </button>
        <span className={styles.by}>by</span>
        <a
          href="https://qqhkx.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.action}
        >
          qqhkx
        </a>
      </div>
    </aside>
  );
}
