import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import Modal from '../Modal/Modal';
import { FormButton, FormButtonGroup } from '../FormComponents/FormComponents';
import { AnnouncementModalProps, AnnouncementTab, AnnouncementTabConfig, MarkdownDocument } from '../../types';
import { setDontShowForWeek } from '../../utils/announcementStorage';
import styles from './AnnouncementModal.module.css';

/**
 * 公告选项卡配置
 */
const ANNOUNCEMENT_TABS: AnnouncementTabConfig[] = [
  {
    key: 'announcement',
    title: '公告',
    filename: 'announcement.md',
    icon: '📢'
  },
  {
    key: 'changelog',
    title: '更新日志',
    filename: 'changelog.md',
    icon: '📝'
  }
];

/**
 * 公告弹窗组件
 * 支持显示公告和更新日志，具有选项卡切换功能
 * 
 * @param props - 组件属性
 * @returns 公告弹窗组件
 */
const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'announcement'
}) => {
  // 当前激活的选项卡
  const [activeTab, setActiveTab] = useState<AnnouncementTab>(initialTab);
  // 是否勾选"一周内不再显示"
  const [dontShowAgain, setDontShowAgain] = useState(false);
  // Markdown文档状态
  const [documents, setDocuments] = useState<Record<AnnouncementTab, MarkdownDocument>>({
    announcement: { content: '', loading: true, filename: 'announcement.md' },
    changelog: { content: '', loading: true, filename: 'changelog.md' }
  });

  /**
   * 加载Markdown文档内容
   * @param filename - 文档文件名
   * @returns Promise<string> - 文档内容
   */
  const loadMarkdownDocument = async (filename: string): Promise<string> => {
    try {
      const response = await fetch(`/docs/${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${filename}: ${response.status}`);
      }
      const content = await response.text();
      return content;
    } catch (error) {
      console.error(`Error loading markdown document ${filename}:`, error);
      throw error;
    }
  };

  /**
   * 渲染Markdown内容为HTML
   * @param content - Markdown内容
   * @returns string - 渲染后的HTML
   */
  const renderMarkdown = (content: string): string => {
    try {
      return marked(content, {
        breaks: true,
        gfm: true,
        async: false
      }) as string;
    } catch (error) {
      console.error('Error rendering markdown:', error);
      return `<p>渲染失败: ${error instanceof Error ? error.message : '未知错误'}</p>`;
    }
  };

  /**
   * 加载选项卡内容
   * @param tab - 要加载的选项卡
   */
  const loadDocument = async (tab: AnnouncementTab) => {
    const tabConfig = ANNOUNCEMENT_TABS.find(t => t.key === tab);
    if (!tabConfig) return;

    setDocuments(prev => ({
      ...prev,
      [tab]: { ...prev[tab], loading: true, error: undefined }
    }));

    try {
      // 尝试多个可能的路径来加载Markdown文件
      const possiblePaths = [
        `/docs/${tabConfig.filename}`,
        `./docs/${tabConfig.filename}`,
        `/public/docs/${tabConfig.filename}`,
        `/${tabConfig.filename}`
      ];

      let content = '';
      let loadSuccess = false;

      for (const path of possiblePaths) {
        try {
          const response = await fetch(path, {
            cache: 'no-cache', // 避免缓存问题
            headers: {
              'Accept': 'text/plain, text/markdown, */*'
            }
          });
          
          if (response.ok) {
            content = await response.text();
            if (content.trim()) { // 确保内容不为空
              loadSuccess = true;
              break;
            }
          }
        } catch (pathError) {
          console.warn(`尝试路径 ${path} 失败:`, pathError);
          continue;
        }
      }

      if (!loadSuccess) {
        throw new Error(`所有路径都无法加载 ${tabConfig.filename}`);
      }
      
      setDocuments(prev => ({
        ...prev,
        [tab]: { content, loading: false, filename: tabConfig.filename }
      }));
    } catch (error) {
      console.error(`Error loading ${tabConfig.filename}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // 提供默认内容而不是空内容
      const defaultContent = tab === 'announcement' 
        ? '# 系统公告\n\n感谢您使用沉浸式时钟！\n\n由于网络问题，暂时无法加载最新公告内容。请稍后重试或访问项目主页获取最新信息。'
        : '# 更新日志\n\n暂时无法加载更新日志内容，请稍后重试。';
      
      setDocuments(prev => ({
        ...prev,
        [tab]: {
          content: defaultContent,
          loading: false,
          filename: tabConfig.filename,
          error: `加载${tabConfig.title}失败: ${errorMessage}`
        }
      }));
    }
  };

  /**
   * 处理关闭弹窗
   */
  const handleClose = () => {
    if (dontShowAgain) {
      setDontShowForWeek();
    }
    onClose();
  };

  /**
   * 处理选项卡切换
   * 
   * @param tab - 要切换到的选项卡
   */
  const handleTabChange = (tab: AnnouncementTab) => {
    setActiveTab(tab);
    // 如果文档还未加载，则加载它
    if (!documents[tab].content && !documents[tab].loading) {
      loadDocument(tab);
    }
  };

  // 组件挂载时加载初始选项卡的文档
  useEffect(() => {
    if (isOpen) {
      // 添加延迟确保组件完全挂载后再加载文档
      const timer = setTimeout(() => {
        loadDocument(activeTab);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab]);

  // 获取当前文档
  const currentDocument = documents[activeTab];
  const currentTabConfig = ANNOUNCEMENT_TABS.find(t => t.key === activeTab);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="系统公告"
      maxWidth="lg"
      footer={
        <div className={styles.footer}>
          <div className={styles.checkboxContainer}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className={styles.checkbox}
              />
              <span className={styles.checkboxText}>一周内不再显示</span>
            </label>
          </div>
          
          <FormButtonGroup>
            <FormButton onClick={handleClose} variant="primary">
              确定
            </FormButton>
          </FormButtonGroup>
        </div>
      }
    >
      <div className={styles.container}>
        {/* 选项卡导航 */}
        <div className={styles.tabNav}>
          {ANNOUNCEMENT_TABS.map(tab => (
            <button
              key={tab.key}
              className={`${styles.tabButton} ${activeTab === tab.key ? styles.active : ''}`}
              onClick={() => handleTabChange(tab.key)}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabTitle}>{tab.title}</span>
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <div className={styles.content}>
          {currentDocument.loading ? (
            <div className={styles.loading}>
              <div className={styles.loadingSpinner}></div>
              <p>正在加载{currentTabConfig?.title}...</p>
            </div>
          ) : currentDocument.error ? (
            <div className={styles.error}>
              <p>⚠️ {currentDocument.error}</p>
              <p>已显示默认内容，您可以：</p>
              <FormButton
                onClick={() => loadDocument(activeTab)}
                variant="secondary"
                size="sm"
              >
                重新加载
              </FormButton>
            </div>
          ) : null}
          
          {/* 始终显示内容，即使有错误也显示默认内容 */}
          {currentDocument.content && (
            <div 
              className={styles.markdownContent}
              dangerouslySetInnerHTML={{ 
                __html: renderMarkdown(currentDocument.content)
              }}
            />
          )}
        </div>

        {/* 底部操作区 */}
      </div>
    </Modal>
  );
};

export default AnnouncementModal;