import React, { useEffect } from 'react';
import styles from '../SettingsPanel.module.css';
import { FormSection } from '../../FormComponents';
// 版本建议优先从环境变量（vite.config 注入）读取，回退到 package.json
const appVersion = import.meta.env.VITE_APP_VERSION;
// 回退读取 package.json 中的元信息（license / homepage 等）
import pkg from '../../../../package.json';

export interface AboutSettingsPanelProps {
  onRegisterSave?: (fn: () => void) => void;
}

const AboutSettingsPanel: React.FC<AboutSettingsPanelProps> = ({ onRegisterSave }) => {
  useEffect(() => {
    // 关于页无保存逻辑，注册一个空操作以保持接口一致性
    if (onRegisterSave) {
      onRegisterSave(() => {});
    }
  }, [onRegisterSave]);

  const version = (appVersion && String(appVersion)) || pkg.version;
  const license = pkg.license || 'MIT';
  const authorSite = pkg.homepage || 'https://qqhkx.com';
  const repoUrl = 'https://github.com/QQHKX/immersive-clock';

  return (
    <div className={styles.settingsGroup} id="about-panel" role="tabpanel" aria-labelledby="about">
      <h3 className={styles.groupTitle}>关于</h3>

      <FormSection title="项目信息">
        <p className={styles.infoText}>版本：v{version}</p>
        <p className={styles.infoText}>版权：{license} License</p>
        <p className={styles.infoText}>
          作者网站：
          <a href={authorSite} target="_blank" rel="noopener noreferrer">{authorSite}</a>
        </p>
        <p className={styles.infoText}>
          开源地址：
          <a href={repoUrl} target="_blank" rel="noopener noreferrer">{repoUrl}</a>
        </p>
      </FormSection>

      <FormSection title="使用声明">
        <p className={styles.infoText}>
          本软件为开源软件，严禁倒卖商用。
        </p>
      </FormSection>
    </div>
  );
};

export default AboutSettingsPanel;