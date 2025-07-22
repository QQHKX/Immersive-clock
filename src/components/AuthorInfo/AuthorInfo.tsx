import React from 'react';
import styles from './AuthorInfo.module.css';

/**
 * 作者信息组件
 * 显示应用的作者和版本信息
 */
export function AuthorInfo() {
  return (
    <div className={styles.authorInfo}>
      <div className={styles.version}>v0.0.0</div>
      <div className={styles.author}>Made with ❤️ by Developer</div>
    </div>
  );
}