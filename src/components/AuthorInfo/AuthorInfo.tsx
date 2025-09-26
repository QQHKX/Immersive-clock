import React from 'react';
import styles from './AuthorInfo.module.css';
import packageJson from '../../../package.json';

interface AuthorInfoProps {
  /** 版本号点击回调函数 */
  onVersionClick?: () => void;
}

/**
 * 作者信息组件
 * 显示应用的作者和版本信息
 * 自动读取package.json中的版本号
 * 支持版本号点击触发公告弹窗
 */
export function AuthorInfo({ onVersionClick }: AuthorInfoProps) {
  /**
   * 处理版本号点击事件
   */
  const handleVersionClick = () => {
    if (onVersionClick) {
      onVersionClick();
    }
  };

  return (
    <div className={styles.authorInfo}>
      <div className={styles.version}>
        <span 
          className={styles.versionNumber} 
          onClick={handleVersionClick}
          title="点击查看公告"
        >
          v{packageJson.version}
        </span>
        {' by '}
        <a 
          href="https://qqhkx.com" 
          target="_blank" 
          rel="noopener noreferrer" 
          className={styles.link}
        >
          qqhkx
        </a>
      </div>
    </div>
  );
}