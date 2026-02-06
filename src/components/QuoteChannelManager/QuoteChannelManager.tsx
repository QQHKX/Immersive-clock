import React, { useState, useCallback, useEffect, useRef } from "react";

import { useAppState, useAppDispatch } from "../../contexts/AppContext";
import { QuoteSourceConfig, HitokotoCategory, HITOKOTO_CATEGORY_LIST } from "../../types";
import { logger } from "../../utils/logger";
import {
  FormSection,
  FormInput,
  FormTextarea,
  FormButton,
  FormButtonGroup,
  FormCheckbox,
  FormSegmented,
} from "../FormComponents";
import {
  ToggleOffIcon,
  ToggleOnIcon,
  SettingsIcon,
  RefreshIcon,
  EditIcon,
  ResetIcon,
  FileIcon,
  TrashIcon,
} from "../Icons";

import styles from "./QuoteChannelManager.module.css";

/**
 * 语录渠道管理组件
 * 支持调节各渠道的获取概率权重和独立启用/禁用每个励志短语获取渠道
 */
export function QuoteChannelManager({
  onRegisterSave,
}: {
  onRegisterSave?: (fn: () => void) => void;
}) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [channels, setChannels] = useState<QuoteSourceConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null);
  const [expandedEditorChannelId, setExpandedEditorChannelId] = useState<string | null>(null);
  const [defaultQuotesMap, setDefaultQuotesMap] = useState<Record<string, string[]>>({});
  const [importError, setImportError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorDraftMap, setEditorDraftMap] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const quoteChannelsRef = useRef(state.quoteChannels.channels);

  useEffect(() => {
    quoteChannelsRef.current = state.quoteChannels.channels;
  }, [state.quoteChannels.channels]);

  /**
   * 从数据文件加载渠道配置
   */
  const loadChannelsFromFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      // 使用 import.meta.glob 动态加载所有 quotes-*.json 文件
      const quoteFiles = import.meta.glob("/src/data/quotes-*.json");
      const loadedChannels: QuoteSourceConfig[] = [];
      const defaults: Record<string, string[]> = {};

      for (const [path, loader] of Object.entries(quoteFiles)) {
        try {
          const module = (await loader()) as { default: QuoteSourceConfig };
          const config = module.default;

          // 确保配置有必要的字段
          if (config.id && config.name !== undefined) {
            loadedChannels.push(config);
            if (Array.isArray(config.quotes)) {
              defaults[config.id] = [...config.quotes];
            }
          }
        } catch (error) {
          logger.warn(`Failed to load quote file ${path}:`, error);
        }
      }

      // 按 ID 排序
      loadedChannels.sort((a, b) => a.id.localeCompare(b.id));
      setChannels(loadedChannels);
      setDefaultQuotesMap(defaults);

      // 如果全局状态中没有渠道配置，则初始化到本地草稿
      const existingChannels = quoteChannelsRef.current;
      if (existingChannels.length === 0) {
        setChannels(loadedChannels);
      } else {
        // 合并现有配置和文件配置
        const mergedBuiltInChannels = loadedChannels.map((fileChannel) => {
          const existingChannel = existingChannels.find((c) => c.id === fileChannel.id);
          return existingChannel || fileChannel;
        });

        // 找出自定义渠道（不在文件列表中的渠道）
        const builtInIds = new Set(loadedChannels.map((c) => c.id));
        const customChannels = existingChannels.filter((c) => !builtInIds.has(c.id));

        setChannels([...mergedBuiltInChannels, ...customChannels]);
      }
    } catch (error) {
      logger.error("Failed to load quote channels:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 切换渠道启用状态
   */
  const handleToggleChannel = useCallback((channelId: string) => {
    // 仅更新本地草稿，不立即分发
    setChannels((prev) =>
      prev.map((channel) =>
        channel.id === channelId ? { ...channel, enabled: !channel.enabled } : channel
      )
    );
  }, []);

  /**
   * 更新渠道权重
   */
  const handleUpdateWeight = useCallback((channelId: string, weight: number) => {
    const clampedWeight = Math.max(1, Math.min(9999, weight));
    // 更新本地状态
    setChannels((prev) =>
      prev.map((channel) =>
        channel.id === channelId ? { ...channel, weight: clampedWeight } : channel
      )
    );
  }, []);

  /**
   * 更新一言分类
   */
  const handleUpdateCategories = useCallback(
    (channelId: string, categories: HitokotoCategory[]) => {
      // 更新本地状态
      setChannels((prev) =>
        prev.map((channel) =>
          channel.id === channelId ? { ...channel, hitokotoCategories: categories } : channel
        )
      );
    },
    []
  );

  /**
   * 更新语录选取模式
   */
  const handleUpdateOrderMode = useCallback(
    (channelId: string, orderMode: "random" | "sequential") => {
      // 更新本地状态
      setChannels((prev) =>
        prev.map((channel) => (channel.id === channelId ? { ...channel, orderMode } : channel))
      );
      // 同时分发到全局，因为这不属于"编辑草稿"，而是即时生效的设置
      dispatch({
        type: "UPDATE_QUOTE_CHANNEL_ORDER_MODE",
        payload: { id: channelId, orderMode },
      });
    },
    [dispatch]
  );

  /**
   * 切换分类选择
   */
  const handleToggleCategory = useCallback(
    (channelId: string, category: HitokotoCategory) => {
      const channel = channels.find((c) => c.id === channelId);
      if (!channel || !channel.hitokotoCategories) return;

      const currentCategories = channel.hitokotoCategories;
      const newCategories = currentCategories.includes(category)
        ? currentCategories.filter((c) => c !== category)
        : [...currentCategories, category];

      handleUpdateCategories(channelId, newCategories);
    },
    [channels, handleUpdateCategories]
  );

  /**
   * 展开/收起渠道详细设置
   */
  const handleToggleExpanded = useCallback((channelId: string) => {
    setExpandedChannelId((prev) => (prev === channelId ? null : channelId));
  }, []);

  /**
   * 切换本地语录编辑器展开/收起
   * @param channelId 渠道ID
   */
  const handleToggleEditorExpanded = useCallback(
    (channelId: string) => {
      setExpandedEditorChannelId((prev) => {
        const next = prev === channelId ? null : channelId;
        if (next) {
          const ch = channels.find((c) => c.id === channelId);
          const initial = Array.isArray(ch?.quotes) ? ch!.quotes!.join("\n") : "";
          setEditorDraftMap((d) => ({ ...d, [channelId]: initial }));
        }
        return next;
      });
    },
    [channels]
  );

  /**
   * 重新加载渠道配置
   */
  const handleRefreshChannels = useCallback(() => {
    loadChannelsFromFiles();
  }, [loadChannelsFromFiles]);

  /**
   * 导入TXT文件作为自定义语录源
   * - 按行分割，过滤空行与超长行
   * - 校验总条目数上限
   */
  const handleImportTxt = useCallback(() => {
    setImportError(null);
    fileInputRef.current?.click();
  }, []);

  /**
   * 处理TXT文件选择与解析
   * @param e input change事件
   */
  const handleImportTxtFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const rawLines = text.split(/\r?\n/);
      const lines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0 && l.length <= 200);

      if (lines.length === 0) {
        setImportError("导入失败：TXT内容为空或格式无效。");
        return;
      }
      if (lines.length > 1000) {
        setImportError("导入失败：语录条目超过上限（1000条）。");
        return;
      }

      const basename = file.name.replace(/\.[^.]+$/, "");
      const newChannel: QuoteSourceConfig = {
        id: `custom-txt-${Date.now()}`,
        name: `自定义语录：${basename}`,
        weight: 10,
        enabled: true,
        onlineFetch: false,
        quotes: lines,
      };

      setChannels((prev) => [...prev, newChannel]);
    } catch (err) {
      logger.error("TXT导入错误:", err);
      setImportError("导入失败：无法读取文件。");
    }
  }, []);

  /**
   * 从文本域更新语录（每行一个）
   * @param channelId 渠道ID
   * @param text 文本域内容
   */
  const handleUpdateQuotesFromTextarea = useCallback((channelId: string, text: string) => {
    setEditorError(null);
    setEditorDraftMap((prev) => ({ ...prev, [channelId]: text }));
    const rawLines = text.split(/\r?\n/);
    const lines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);

    if (lines.length > 1000) {
      setEditorError("编辑提示：语录条目超过上限（1000行）。");
    } else if (lines.some((l) => l.length > 200)) {
      setEditorError("编辑提示：存在超过200字符的长句，建议适当裁剪。");
    }

    setChannels((prev) => prev.map((ch) => (ch.id === channelId ? { ...ch, quotes: lines } : ch)));
  }, []);

  /**
   * 删除自定义语录渠道
   * 仅支持删除通过TXT导入的自定义渠道（ID以custom-txt-开头）
   * 删除时同时清理展开状态与编辑草稿
   */
  const handleDeleteChannel = useCallback((channelId: string) => {
    setChannels((prev) => prev.filter((ch) => ch.id !== channelId));
    setExpandedChannelId((prev) => (prev === channelId ? null : prev));
    setExpandedEditorChannelId((prev) => (prev === channelId ? null : prev));
    setEditorDraftMap((prev) => {
      const { [channelId]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  /**
   * 恢复该渠道全部语录为系统默认（仅内置源）
   * @param channelId 渠道ID
   */
  const handleRestoreDefaultAll = useCallback(
    (channelId: string) => {
      const defaults = defaultQuotesMap[channelId];
      if (!defaults) return;
      setChannels((prev) =>
        prev.map((ch) => (ch.id === channelId ? { ...ch, quotes: [...defaults] } : ch))
      );
      setEditorDraftMap((prev) => ({ ...prev, [channelId]: defaults.join("\n") }));
      setEditorError(null);
    },
    [defaultQuotesMap]
  );

  // 组件挂载时加载渠道配置
  useEffect(() => {
    loadChannelsFromFiles();
  }, [loadChannelsFromFiles]);

  // 同步全局状态变化
  useEffect(() => {
    if (state.quoteChannels.channels.length > 0) {
      setChannels(state.quoteChannels.channels);
    }
  }, [state.quoteChannels.channels]);

  // 注册保存：保存当前草稿到全局状态与本地存储
  useEffect(() => {
    onRegisterSave?.(() => {
      dispatch({ type: "UPDATE_QUOTE_CHANNELS", payload: channels });
    });
  }, [onRegisterSave, channels, dispatch]);

  if (isLoading) {
    return (
      <FormSection title="语录渠道管理">
        <div className={styles.loading}>
          <RefreshIcon className={styles.loadingIcon} />
          <span>加载渠道配置中...</span>
        </div>
      </FormSection>
    );
  }

  return (
    <FormSection title="语录渠道管理">
      <p className={styles.helpText}>管理励志语录的获取渠道，调节各渠道的权重和启用状态。</p>

      <FormButtonGroup align="right">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          style={{ display: "none" }}
          onChange={handleImportTxtFileChange}
        />
        <FormButton
          variant="secondary"
          onClick={handleImportTxt}
          icon={<FileIcon size={16} />}
          aria-label="导入TXT语录源"
          title="导入TXT语录源"
        >
          导入TXT
        </FormButton>
        <FormButton
          variant="secondary"
          onClick={handleRefreshChannels}
          icon={<RefreshIcon size={16} />}
        >
          刷新配置
        </FormButton>
      </FormButtonGroup>

      {importError && (
        <div className={styles.errorText} role="alert">
          {importError}
        </div>
      )}

      <div className={styles.channelList}>
        {channels.map((channel) => (
          <div key={channel.id} className={styles.channelItem}>
            <div className={styles.channelHeader}>
              <div className={styles.channelInfo}>
                <h4 className={styles.channelName}>{channel.name}</h4>
                <span className={styles.channelType}>
                  {channel.onlineFetch ? "在线获取" : "本地数据"}
                </span>
              </div>

              <div className={styles.channelControls}>
                <div className={styles.weightControl}>
                  <label className={styles.weightLabel}>权重:</label>
                  <FormInput
                    type="number"
                    value={channel.weight.toString()}
                    onChange={(e) => handleUpdateWeight(channel.id, parseInt(e.target.value) || 1)}
                    variant="number"
                    min={1}
                    max={9999}
                    className={styles.weightInput}
                  />
                </div>

                <FormButton
                  className={styles.toggleButton}
                  onClick={() => handleToggleChannel(channel.id)}
                  variant="secondary"
                  size="sm"
                  aria-label={channel.enabled ? "点击禁用" : "点击启用"}
                  title={channel.enabled ? "点击禁用" : "点击启用"}
                  icon={
                    channel.enabled ? (
                      <ToggleOnIcon className={styles.toggleIconEnabled} />
                    ) : (
                      <ToggleOffIcon className={styles.toggleIconDisabled} />
                    )
                  }
                />

                {channel.onlineFetch && channel.hitokotoCategories && (
                  <FormButton
                    className={styles.settingsButton}
                    onClick={() => handleToggleExpanded(channel.id)}
                    variant="secondary"
                    size="sm"
                    title="分类设置"
                    aria-label="分类设置"
                    icon={<SettingsIcon size={16} />}
                  />
                )}

                {!channel.onlineFetch && (
                  <FormButton
                    className={styles.settingsButton}
                    onClick={() => handleToggleEditorExpanded(channel.id)}
                    variant="secondary"
                    size="sm"
                    title="编辑语录"
                    aria-label="编辑语录"
                    icon={<EditIcon size={16} />}
                  />
                )}

                {/* 删除按钮移至本地编辑器内部，仅保留头部基础控制 */}
              </div>
            </div>

            {/* 一言分类设置 */}
            {expandedChannelId === channel.id &&
              channel.onlineFetch &&
              channel.hitokotoCategories && (
                <div className={styles.categorySettings}>
                  <h5 className={styles.categoryTitle}>一言分类选择</h5>
                  <div className={styles.categoryGrid}>
                    {HITOKOTO_CATEGORY_LIST.map((category) => (
                      <FormCheckbox
                        key={category.key}
                        label={category.name}
                        checked={channel.hitokotoCategories!.includes(category.key)}
                        onChange={() => handleToggleCategory(channel.id, category.key)}
                        className={styles.categoryItem}
                      />
                    ))}
                  </div>
                  <div className={styles.categoryInfo}>
                    <p className={styles.helpText}>
                      已选择 {channel.hitokotoCategories.length} 个分类。
                      未选择任何分类时将获取所有类型的一言。
                    </p>
                  </div>
                </div>
              )}

            {/* 本地语录编辑器 */}
            {expandedEditorChannelId === channel.id && !channel.onlineFetch && (
              <div className={styles.editorSection}>
                <div className={styles.editorHeader}>
                  <h5 className={styles.editorTitle}>语录编辑器</h5>
                  <div className={styles.quoteActions}>
                    <FormSegmented
                      value={channel.orderMode || "random"}
                      onChange={(val) =>
                        handleUpdateOrderMode(channel.id, val as "random" | "sequential")
                      }
                      options={[
                        { value: "sequential", label: "顺序" },
                        { value: "random", label: "随机" },
                      ]}
                    />
                    <FormButton
                      variant="secondary"
                      size="sm"
                      title="恢复默认（全部）"
                      aria-label="恢复默认（全部）"
                      icon={<ResetIcon size={16} />}
                      disabled={!defaultQuotesMap[channel.id]}
                      onClick={() => handleRestoreDefaultAll(channel.id)}
                    />
                    {channel.id.startsWith("custom-txt-") && (
                      <FormButton
                        onClick={() => handleDeleteChannel(channel.id)}
                        variant="danger"
                        size="sm"
                        title="删除语录源"
                        aria-label="删除语录源"
                        icon={<TrashIcon size={16} />}
                      >
                        删除
                      </FormButton>
                    )}
                  </div>
                </div>
                <FormTextarea
                  label="语录文本（每行一个）"
                  className={styles.quoteTextarea}
                  value={
                    editorDraftMap[channel.id] ??
                    (Array.isArray(channel.quotes) ? channel.quotes.join("\n") : "")
                  }
                  onChange={(e) => handleUpdateQuotesFromTextarea(channel.id, e.target.value)}
                  placeholder={
                    "例如：\n保持专注，持续前进。\n小步快跑，积累成塔。\n接受不完美并继续优化。"
                  }
                  aria-label={`编辑 ${channel.name} 的语录文本，每行一个`}
                  rows={10}
                />
                <div className={styles.importInfo}>
                  <p className={styles.helpText}>
                    当前条目：{Array.isArray(channel.quotes) ? channel.quotes.length : 0}
                  </p>
                </div>
                {editorError && (
                  <div className={styles.errorText} role="alert">
                    {editorError}
                  </div>
                )}
                {(!channel.quotes || channel.quotes.length === 0) && (
                  <div className={styles.importInfo}>
                    <p className={styles.helpText}>
                      当前渠道暂无语录，可通过“导入TXT”或在上方文本框直接编写。
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {channels.length === 0 && (
        <div className={styles.emptyState}>
          <p>未找到任何语录渠道配置</p>
          <FormButton
            variant="primary"
            onClick={handleRefreshChannels}
            icon={<RefreshIcon size={16} />}
          >
            重新加载
          </FormButton>
        </div>
      )}
    </FormSection>
  );
}
