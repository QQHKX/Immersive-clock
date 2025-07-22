import React from 'react';
import styles from './AuthorInfo.module.css';
import packageJson from '../../../package.json';

/**
 * 作者信息组件
 * 显示应用的作者和版本信息
 * 自动读取package.json中的版本号
 */
export function AuthorInfo() {
  return (
    <div className={styles.authorInfo}>
      <div className={styles.version}>v{packageJson.version} by <a href="https://qqhkx.com" target="_blank" rel="noopener noreferrer" className={styles.link}>qqhkx</a></div>
    </div>
  );
}