import React from 'react';
import styles from './AuthorInfo.module.css';

/**
 * 作者信息组件
 * 显示应用的作者和版本信息
 */
export function AuthorInfo() {
  return (
    <div className={styles.authorInfo}>
      <div className={styles.version}>v2.0 by <a href="https://qqhkx.com" target="_blank" rel="noopener noreferrer" className={styles.link}>qqhkx</a></div>
    </div>
  );
}