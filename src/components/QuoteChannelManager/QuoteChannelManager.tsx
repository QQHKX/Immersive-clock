import React, { useState, useCallback, useEffect } from 'react';
import { ToggleOffIcon, ToggleOnIcon, SettingsIcon, RefreshIcon } from '../Icons';
import { useAppState, useAppDispatch } from '../../contexts/AppContext';
import { QuoteSourceConfig, HitokotoCategory, HITOKOTO_CATEGORY_LIST } from '../../types';
import { FormSection, FormInput, FormButton, FormButtonGroup, FormRow } from '../FormComponents';
import styles from './QuoteChannelManager.module.css';

/**
 * 金句渠道管理组件
 * 支持调节各渠道的获取概率权重和独立启用/禁用每个励志短语获取渠道
 */
export function QuoteChannelManager() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [channels, setChannels] = useState<QuoteSourceConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null);

  /**
   * 从数据文件加载渠道配置
   */
  const loadChannelsFromFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      // 使用 import.meta.glob 动态加载所有 quotes-*.json 文件
      const quoteFiles = import.meta.glob('/src/data/quotes-*.json');
      const loadedChannels: QuoteSourceConfig[] = [];

      for (const [path, loader] of Object.entries(quoteFiles)) {
        try {
          const module = await loader() as { default: QuoteSourceConfig };
          const config = module.default;
          
          // 确保配置有必要的字段
          if (config.id && config.name !== undefined) {
            loadedChannels.push(config);
          }
        } catch (error) {
          console.warn(`Failed to load quote file ${path}:`, error);
        }
      }

      // 按 ID 排序
      loadedChannels.sort((a, b) => a.id.localeCompare(b.id));
      setChannels(loadedChannels);

      // 如果全局状态中没有渠道配置，则初始化
      if (state.quoteChannels.channels.length === 0) {
        dispatch({
          type: 'UPDATE_QUOTE_CHANNELS',
          payload: loadedChannels
        });
      } else {
        // 合并现有配置和文件配置
        const mergedChannels = loadedChannels.map(fileChannel => {
          const existingChannel = state.quoteChannels.channels.find(c => c.id === fileChannel.id);
          return existingChannel || fileChannel;
        });
        setChannels(mergedChannels);
      }
    } catch (error) {
      console.error('Failed to load quote channels:', error);
    } finally {
      setIsLoading(false);
    }
  }, [state.quoteChannels.channels, dispatch]);

  /**
   * 切换渠道启用状态
   */
  const handleToggleChannel = useCallback((channelId: string) => {
    dispatch({
      type: 'TOGGLE_QUOTE_CHANNEL',
      payload: channelId
    });
    
    // 更新本地状态
    setChannels(prev => prev.map(channel =>
      channel.id === channelId
        ? { ...channel, enabled: !channel.enabled }
        : channel
    ));
  }, [dispatch]);

  /**
   * 更新渠道权重
   */
  const handleUpdateWeight = useCallback((channelId: string, weight: number) => {
    const clampedWeight = Math.max(1, Math.min(99, weight));
    
    dispatch({
      type: 'UPDATE_QUOTE_CHANNEL_WEIGHT',
      payload: { id: channelId, weight: clampedWeight }
    });
    
    // 更新本地状态
    setChannels(prev => prev.map(channel =>
      channel.id === channelId
        ? { ...channel, weight: clampedWeight }
        : channel
    ));
  }, [dispatch]);

  /**
   * 更新一言分类
   */
  const handleUpdateCategories = useCallback((channelId: string, categories: HitokotoCategory[]) => {
    dispatch({
      type: 'UPDATE_QUOTE_CHANNEL_CATEGORIES',
      payload: { id: channelId, categories }
    });
    
    // 更新本地状态
    setChannels(prev => prev.map(channel =>
      channel.id === channelId
        ? { ...channel, hitokotoCategories: categories }
        : channel
    ));
  }, [dispatch]);

  /**
   * 切换分类选择
   */
  const handleToggleCategory = useCallback((channelId: string, category: HitokotoCategory) => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel || !channel.hitokotoCategories) return;

    const currentCategories = channel.hitokotoCategories;
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];

    handleUpdateCategories(channelId, newCategories);
  }, [channels, handleUpdateCategories]);

  /**
   * 展开/收起渠道详细设置
   */
  const handleToggleExpanded = useCallback((channelId: string) => {
    setExpandedChannelId(prev => prev === channelId ? null : channelId);
  }, []);

  /**
   * 重新加载渠道配置
   */
  const handleRefreshChannels = useCallback(() => {
    loadChannelsFromFiles();
  }, [loadChannelsFromFiles]);

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

  if (isLoading) {
    return (
      <FormSection title="金句渠道管理">
        <div className={styles.loading}>
          <RefreshIcon className={styles.loadingIcon} />
          <span>加载渠道配置中...</span>
        </div>
      </FormSection>
    );
  }

  return (
    <FormSection title="金句渠道管理">
      <div className={styles.channelManagerInfo}>
        <p className={styles.infoText}>
          管理励志金句的获取渠道，调节各渠道的权重和启用状态。
        </p>
      </div>

      <FormButtonGroup align="right">
        <FormButton
          variant="secondary"
          onClick={handleRefreshChannels}
          icon={<RefreshIcon size={16} />}
        >
          刷新配置
        </FormButton>
      </FormButtonGroup>

      <div className={styles.channelList}>
        {channels.map(channel => (
          <div key={channel.id} className={styles.channelItem}>
            <div className={styles.channelHeader}>
              <div className={styles.channelInfo}>
                <h4 className={styles.channelName}>{channel.name}</h4>
                <span className={styles.channelType}>
                  {channel.onlineFetch ? '在线获取' : '本地数据'}
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
                    max={99}
                    className={styles.weightInput}
                  />
                </div>
                
                <button
                  className={styles.toggleButton}
                  onClick={() => handleToggleChannel(channel.id)}
                  title={channel.enabled ? '点击禁用' : '点击启用'}
                >
                  {channel.enabled ? (
                    <ToggleOnIcon className={styles.toggleIconEnabled} />
                  ) : (
                    <ToggleOffIcon className={styles.toggleIconDisabled} />
                  )}
                </button>
                
                {channel.onlineFetch && channel.hitokotoCategories && (
                  <button
                    className={styles.settingsButton}
                    onClick={() => handleToggleExpanded(channel.id)}
                    title="分类设置"
                  >
                    <SettingsIcon size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* 一言分类设置 */}
            {expandedChannelId === channel.id && channel.onlineFetch && channel.hitokotoCategories && (
              <div className={styles.categorySettings}>
                <h5 className={styles.categoryTitle}>一言分类选择</h5>
                <div className={styles.categoryGrid}>
                  {HITOKOTO_CATEGORY_LIST.map(category => (
                    <label key={category.key} className={styles.categoryItem}>
                      <input
                        type="checkbox"
                        checked={channel.hitokotoCategories!.includes(category.key)}
                        onChange={() => handleToggleCategory(channel.id, category.key)}
                        className={styles.categoryCheckbox}
                      />
                      <span className={styles.categoryLabel}>
                        {category.name}
                      </span>
                    </label>
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
          </div>
        ))}
      </div>

      {channels.length === 0 && (
        <div className={styles.emptyState}>
          <p>未找到任何金句渠道配置</p>
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