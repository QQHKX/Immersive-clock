import React, { useState, useEffect, useCallback, useRef } from 'react';
// 移除旧的静态引入：import quotes from '../../data/quotes.json';
import styles from './MotivationalQuote.module.css';

/**
 * 数据源配置类型
 */
type QuoteSourceConfig = {
  weight: number; // 权重值 1-99
  onlineFetch: boolean; // 是否线上拉取
  apiEndpoint?: string; // API 地址（如适用）
  quotes?: string[]; // 本地语录
};

/**
 * 一言 API 返回数据类型（核心字段）
 */
type HitokotoResponse = {
  hitokoto: string;
  type?: string;
  from?: string;
  from_who?: string | null;
};

/**
 * 励志金句组件
 * - 修复句子更新时的闪现问题，确保动画从空串开始逐字符显示
 * - 支持多来源（本地/线上）按权重随机
 * - 集成一言 API 展示格式：文本 ——来源（单行）
 */
export function MotivationalQuote() {
  const [currentQuote, setCurrentQuote] = useState(''); // 完整显示用
  const [displayText, setDisplayText] = useState(''); // 打字动画显示用
  const [isTyping, setIsTyping] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 通过 Vite 的 import.meta.glob 收集所有 quotes-*.json 源
  const sourcesRef = useRef<QuoteSourceConfig[] | null>(null);
  if (sourcesRef.current === null) {
    const modules = import.meta.glob('../../data/quotes-*.json', { eager: true });
    const parsed: QuoteSourceConfig[] = Object.values(modules).map((mod: any) => mod.default ?? mod) as QuoteSourceConfig[];
    // 过滤非法配置，权重与来源字段校验
    sourcesRef.current = parsed.filter((s) => s && typeof s.weight === 'number' && s.weight > 0);
  }

  /**
   * 根据权重随机挑选数据源
   */
  const pickWeightedSource = useCallback((): QuoteSourceConfig | null => {
    const sources = sourcesRef.current ?? [];
    if (!sources.length) return null;
    const total = sources.reduce((sum, s) => sum + (s.weight || 0), 0);
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (const s of sources) {
      r -= s.weight || 0;
      if (r <= 0) return s;
    }
    return sources[sources.length - 1];
  }, []);

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
   * 获取线上一言（或其他 API）并格式化
   * 展示格式（单行）：
   *   文本 ——来源（如果有）
   */
  const fetchOnlineQuote = useCallback(async (source: QuoteSourceConfig): Promise<string | null> => {
    const endpoint = (source.apiEndpoint || '').trim();
    if (!endpoint) return null;
    try {
      const res = await fetch(endpoint, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as HitokotoResponse;
      const text = (data?.hitokoto || '').trim();
      if (!text) return null;
      const from = (data?.from || '').trim();
      let final = text;
      if (from) final = `${text} ——${from}`;
      return final;
    } catch (e) {
      console.warn('[MotivationalQuote] 在线语录获取失败，将回退到本地源：', e);
      return null;
    }
  }, []);

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
      const fallback = '努力拼搏，成就梦想！';
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
      text = '努力拼搏，成就梦想！';
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
    const interval = setInterval(() => {
      void updateQuote();
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [updateQuote]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
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