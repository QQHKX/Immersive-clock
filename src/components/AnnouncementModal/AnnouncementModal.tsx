import { marked } from "marked";
import React, { useCallback, useState, useEffect, useRef } from "react";

import {
  AnnouncementModalProps,
  AnnouncementTab,
  AnnouncementTabConfig,
  MarkdownDocument,
} from "../../types";
import { setDontShowForWeek } from "../../utils/announcementStorage";
import { logger } from "../../utils/logger";
import { FormButton, FormButtonGroup, FormCheckbox } from "../FormComponents/FormComponents";
import Modal from "../Modal/Modal";
import modalStyles from "../Modal/Modal.module.css";
import { Tabs } from "../Tabs/Tabs";

import styles from "./AnnouncementModal.module.css";

/**
 * 公告选项卡配置
 */
const ANNOUNCEMENT_TABS: AnnouncementTabConfig[] = [
  {
    key: "announcement",
    title: "公告",
    filename: "announcement.md",
    icon: "📢",
  },
  {
    key: "changelog",
    title: "更新日志",
    filename: "changelog.md",
    icon: "📝",
  },
  {
    key: "feedback",
    title: "意见反馈",
    iframeSrc: "https://wj.qq.com/s2/25666249/lj9p/",
    icon: "💬",
  },
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
  initialTab = "announcement",
}) => {
  type MarkdownAnnouncementTab = Exclude<AnnouncementTab, "feedback">;

  // 当前激活的选项卡
  const [activeTab, setActiveTab] = useState<AnnouncementTab>(initialTab);
  const containerRef = useRef<HTMLDivElement>(null);
  // 是否勾选"一周内不再显示"
  const [dontShowAgain, setDontShowAgain] = useState(false);
  // Markdown文档状态
  const [documents, setDocuments] = useState<Record<MarkdownAnnouncementTab, MarkdownDocument>>({
    announcement: { content: "", loading: true, filename: "announcement.md" },
    changelog: { content: "", loading: true, filename: "changelog.md" },
  });

  /**
   * 判断当前选项卡是否为 Markdown 类型
   * @param tab - 当前选项卡
   */
  const isMarkdownTab = useCallback(
    (tab: AnnouncementTab): tab is MarkdownAnnouncementTab =>
      tab === "announcement" || tab === "changelog",
    []
  );

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
        async: false,
      }) as string;
    } catch (error) {
      logger.error("Error rendering markdown:", error);
      return `<p>渲染失败: ${error instanceof Error ? error.message : "未知错误"}</p>`;
    }
  };

  /**
   * 加载选项卡内容
   * @param tab - 要加载的选项卡
   */
  const loadDocument = useCallback(async (tab: MarkdownAnnouncementTab) => {
    const tabConfig = ANNOUNCEMENT_TABS.find((t) => t.key === tab);
    if (!tabConfig || !("filename" in tabConfig)) return;

    setDocuments((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], loading: true, error: undefined },
    }));

    try {
      // 从 docs 目录加载 Markdown 文件，使用 Vite 的 BASE_URL 以支持 Electron 打包后的相对路径
      const response = await fetch(`${import.meta.env.BASE_URL}docs/${tabConfig.filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${tabConfig.filename}: ${response.status}`);
      }

      const content = await response.text();
      setDocuments((prev) => ({
        ...prev,
        [tab]: { content, loading: false, filename: tabConfig.filename },
      }));
    } catch (error) {
      logger.error(`Error loading ${tabConfig.filename}:`, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setDocuments((prev) => ({
        ...prev,
        [tab]: {
          content: "",
          loading: false,
          filename: tabConfig.filename,
          error: `加载${tabConfig.title}失败: ${errorMessage}`,
        },
      }));
    }
  }, []);

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
    if (isMarkdownTab(tab)) {
      // 如果文档还未加载，则加载它
      if (!documents[tab].content && !documents[tab].loading) {
        loadDocument(tab);
      }
    }
  };

  // 切换选项卡时将模态内容滚动到顶部
  useEffect(() => {
    if (!isOpen) return;
    const root = containerRef.current;
    if (root) {
      const bodyEl = root.closest(`.${modalStyles.modalBody}`) as HTMLElement | null;
      if (bodyEl) bodyEl.scrollTo({ top: 0, behavior: "smooth" });
      const inner = root.querySelector(`.${styles.content}`) as HTMLElement | null;
      if (inner) inner.scrollTo({ top: 0 });
    }
  }, [activeTab, isOpen]);

  // 组件挂载时加载初始选项卡的文档
  useEffect(() => {
    if (isOpen && isMarkdownTab(activeTab)) {
      loadDocument(activeTab);
    }
  }, [isOpen, activeTab, isMarkdownTab, loadDocument]);

  // 获取当前文档
  const currentDocument = isMarkdownTab(activeTab) ? documents[activeTab] : undefined;
  const currentTabConfig = ANNOUNCEMENT_TABS.find((t) => t.key === activeTab);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="系统公告"
      maxWidth="lg"
      headerDivider={false}
      compactBodyTop
      footer={
        <div className={styles.footer}>
          <div className={styles.checkboxContainer}>
            <FormCheckbox
              label="一周内不再显示"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
          </div>

          <FormButtonGroup>
            <FormButton onClick={handleClose} variant="primary">
              确定
            </FormButton>
          </FormButtonGroup>
        </div>
      }
    >
      <div ref={containerRef} className={styles.container}>
        {/* 选项卡导航：统一使用 Tabs 组件（公告风格） */}
        <Tabs
          items={ANNOUNCEMENT_TABS.map((t) => ({ key: t.key, label: t.title, icon: t.icon }))}
          activeKey={activeTab}
          onChange={(key) => handleTabChange(key as AnnouncementTab)}
          variant="announcement"
          size="md"
          scrollable
          sticky
        />

        {/* 内容区域 */}
        <div
          className={`${styles.content} ${activeTab === "feedback" ? styles.contentIframe : ""}`}
        >
          {activeTab === "feedback" && currentTabConfig && "iframeSrc" in currentTabConfig ? (
            <div className={styles.iframeContainer}>
              <div className={styles.iframeViewport}>
                <iframe
                  id="idy_frame"
                  title="意见反馈（腾讯问卷）"
                  src={currentTabConfig.iframeSrc}
                  width="100%"
                  height="100%"
                  loading="lazy"
                  className={styles.feedbackIframe}
                  allowFullScreen
                  sandbox="allow-same-origin allow-scripts allow-modals allow-downloads allow-forms allow-popups"
                />
                <div className={styles.scrollbarMaskY} aria-hidden />
                <div className={styles.scrollbarMaskX} aria-hidden />
              </div>
              <div className={styles.iframeFallback}>
                <a href={currentTabConfig.iframeSrc} target="_blank" rel="noreferrer">
                  无法加载？点击在新窗口打开问卷
                </a>
              </div>
            </div>
          ) : currentDocument?.loading ? (
            <div className={styles.loading}>
              <div className={styles.loadingSpinner}></div>
              <p>正在加载{currentTabConfig?.title}...</p>
            </div>
          ) : currentDocument?.error ? (
            <div className={styles.error}>
              <p>加载失败：{currentDocument.error}</p>
              <FormButton
                onClick={() => {
                  if (isMarkdownTab(activeTab)) loadDocument(activeTab);
                }}
                variant="secondary"
                size="sm"
              >
                重试
              </FormButton>
            </div>
          ) : (
            <div
              className={styles.markdownContent}
              dangerouslySetInnerHTML={{
                __html: currentDocument?.content ? renderMarkdown(currentDocument.content) : "",
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
