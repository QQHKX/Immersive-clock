import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppState } from '../../contexts/AppContext';
import { QuoteSourceConfig, HitokotoResponse, HitokotoCategory } from '../../types';
import styles from './MotivationalQuote.module.css';

/**
 * 励志金句组件
 * - 支持多渠道加权随机选择
 * - 支持一言API多分类选择
 * - 修复句子更新时的闪现问题，确保动画从空串开始逐字符显示
 * - 集成一言 API 展示格式：文本 ——来源（单行）
 * - 支持自定义自动刷新间隔
 */
export function MotivationalQuote() {
  const { quoteChannels, quoteSettings } = useAppState();
  const [currentQuote, setCurrentQuote] = useState(''); // 完整显示用
  const [displayText, setDisplayText] = useState(''); // 打字动画显示用
  const [isTyping, setIsTyping] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 通过 Vite 的 import.meta.glob 收集所有 quotes-*.json 源作为备用
  const fallbackSourcesRef = useRef<QuoteSourceConfig[] | null>(null);
  const [fallbackSourcesLoaded, setFallbackSourcesLoaded] = useState(false);

  /**
   * 动态加载备用数据源
   */
  const loadFallbackSources = useCallback(async () => {
    if (fallbackSourcesRef.current !== null) return;
    
    try {
      const modules = import.meta.glob('../../data/quotes-*.json');
      const loadedSources: QuoteSourceConfig[] = [];
      
      for (const [path, loader] of Object.entries(modules)) {
        try {
          const module = await loader() as { default: QuoteSourceConfig };
          const config = module.default;
          
          // 过滤非法配置，权重与来源字段校验
          if (config && typeof config.weight === 'number' && config.weight > 0) {
            loadedSources.push(config);
          }
        } catch (error) {
          console.warn(`Failed to load fallback quote file ${path}:`, error);
        }
      }
      
      fallbackSourcesRef.current = loadedSources;
      setFallbackSourcesLoaded(true);
    } catch (error) {
      console.warn('Failed to load fallback quote sources:', error);
      fallbackSourcesRef.current = [];
      setFallbackSourcesLoaded(true);
    }
  }, []);

  // 在组件挂载时加载备用数据源
  useEffect(() => {
    loadFallbackSources();
  }, [loadFallbackSources]);

  /**
   * 获取当前可用的渠道列表
   * 优先使用全局状态中的配置，如果没有则使用备用配置
   */
  const getAvailableChannels = useCallback((): QuoteSourceConfig[] => {
    if (quoteChannels?.channels?.length > 0) {
      return quoteChannels.channels.filter(channel => channel.enabled && channel.weight > 0);
    }
    // 回退到文件配置（仅在备用数据源加载完成后）
    if (fallbackSourcesLoaded && fallbackSourcesRef.current) {
      return fallbackSourcesRef.current.filter(s => s.weight > 0);
    }
    return [];
  }, [quoteChannels, fallbackSourcesLoaded]);

  /**
   * 根据权重随机挑选数据源
   */
  const pickWeightedSource = useCallback((): QuoteSourceConfig | null => {
    const sources = getAvailableChannels();
    if (!sources.length) return null;
    
    const total = sources.reduce((sum, s) => sum + (s.weight || 0), 0);
    if (total <= 0) return null;
    
    let r = Math.random() * total;
    for (const s of sources) {
      r -= s.weight || 0;
      if (r <= 0) return s;
    }
    return sources[sources.length - 1];
  }, [getAvailableChannels]);

  /**
   * 从本地源随机取一句
   */
  const getLocalRandomQuote = useCallback((source: QuoteSourceConfig): string | null => {
    const list = source.quotes || [];
    if (!Array.isArray(list) || list.length === 0) return null;
    const idx = Math.floor(Math.random() * list.length);
    return list[idx] ?? null;
  }, []);

  /**
   * 构建一言API请求URL，支持多分类选择
   */
  const buildHitokotoUrl = useCallback((source: QuoteSourceConfig): string => {
    let url = source.apiEndpoint || 'https://v1.hitokoto.cn/';
    
    // 添加分类参数
    if (source.hitokotoCategories && source.hitokotoCategories.length > 0) {
      const params = new URLSearchParams();
      source.hitokotoCategories.forEach(category => {
        params.append('c', category);
      });
      url += '?' + params.toString();
    }
    
    return url;
  }, []);

  /**
   * 获取线上一言（或其他 API）并格式化
   * 展示格式（单行）：
   *   文本 ——来源（如果有）
   */
  const fetchOnlineQuote = useCallback(async (source: QuoteSourceConfig): Promise<string | null> => {
    try {
      const url = buildHitokotoUrl(source);
      const res = await fetch(url, { 
        cache: 'no-store',
        signal: AbortSignal.timeout(5000) // 5秒超时
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = (await res.json()) as HitokotoResponse;
      const text = (data?.hitokoto || '').trim();
      if (!text) return null;
      
      const from = (data?.from || '').trim();
      let final = text;
      if (from) final = `${text} ——${from}`;
      
      return final;
    } catch (e) {
      console.warn(`[MotivationalQuote] 在线语录获取失败 (${source.name})，将回退到本地源：`, e);
      return null;
    }
  }, [buildHitokotoUrl]);

  /**
   * 打字机动画效果
   * 确保每次从空串开始，不出现完整文本的闪现
   */
  const typewriterEffect = useCallback((text: string) => {
    if (!text) return;
    
    // 清理之前的定时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // 重置显示状态
    setDisplayText('');
    setIsTyping(true);

    let index = 0;
    timerRef.current = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.substring(0, index + 1));
        index++;
      } else {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setIsTyping(false);
      }
    }, 120);
  }, []);

  /**
   * 统一更新金句逻辑：按权重挑源 -> 获取内容（优先线上，失败回退本地） -> 启动动画
   */
  const updateQuote = useCallback(async () => {
    const source = pickWeightedSource();
    if (!source) {
      const fallback = '保持热爱，奔赴山海。\n——系统提示';
      setCurrentQuote(fallback);
      typewriterEffect(fallback);
      return;
    }

    let text: string | null = null;
    
    if (source.onlineFetch) {
      text = await fetchOnlineQuote(source);
      if (!text) {
        // 线上失败则回退到本地
        text = getLocalRandomQuote(source);
      }
    } else {
      text = getLocalRandomQuote(source);
    }

    // 兜底
    if (!text) {
      text = '保持热爱，奔赴山海。\n——系统提示';
    }

    // 先记录完整文本，再启动动画。渲染时会根据 isTyping 决定显示 displayText，避免闪现
    setCurrentQuote(text);
    typewriterEffect(text);
  }, [fetchOnlineQuote, getLocalRandomQuote, pickWeightedSource, typewriterEffect]);

  /** 手动刷新 */
  const handleClick = useCallback(() => {
    if (!isTyping) {
      void updateQuote();
    }
  }, [isTyping, updateQuote]);

  /** 初始化与轮训更新 */
  useEffect(() => {
    void updateQuote();
    
    // 清理之前的自动刷新定时器
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
    }
    
    // 如果自动刷新间隔大于等于1800秒，则不设置自动刷新（手动刷新模式）
    if (quoteSettings.autoRefreshInterval < 1800) {
      autoRefreshTimerRef.current = setInterval(() => {
        void updateQuote();
      }, quoteSettings.autoRefreshInterval * 1000);
    }
    
    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [updateQuote, quoteSettings.autoRefreshInterval]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={styles.motivationalQuote}
      onClick={handleClick}
      title="点击刷新励志金句"
    >
      <div className={`${styles.quoteText} ${isTyping ? styles.typing : ''}`}>
        {isTyping ? displayText : currentQuote}
        {isTyping && <span className={styles.cursor}>|</span>}
      </div>
    </div>
  );
}

export default MotivationalQuote;