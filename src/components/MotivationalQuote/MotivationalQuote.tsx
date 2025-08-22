import React, { useState, useEffect, useCallback, useRef } from 'react';
import quotes from '../../data/quotes.json';
import styles from './MotivationalQuote.module.css';

/**
 * 励志金句组件
 * 显示高考励志短句，支持自动更新和手动刷新
 */
export function MotivationalQuote() {
  const [currentQuote, setCurrentQuote] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 获取随机励志金句
   */
  const getRandomQuote = useCallback(() => {
    if (!quotes || quotes.length === 0) {
      return '努力拼搏，成就梦想！'; // 默认金句
    }
    const randomIndex = Math.floor(Math.random() * quotes.length);
    return quotes[randomIndex];
  }, []);

  /**
   * 打字机动画效果
   */
  const typewriterEffect = useCallback((text: string) => {
    if (!text) return;
    
    // 清理之前的定时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // 重置状态
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
    }, 120); // 每120ms显示一个字符
  }, []);

  /**
   * 更新励志金句
   */
  const updateQuote = useCallback(() => {
    let newQuote = getRandomQuote();
    let attempts = 0;
    
    // 确保不重复显示相同的金句，最多尝试5次避免无限循环
    while (newQuote === currentQuote && attempts < 5) {
      newQuote = getRandomQuote();
      attempts++;
    }
    
    setCurrentQuote(newQuote);
    typewriterEffect(newQuote);
  }, [currentQuote, getRandomQuote, typewriterEffect]);

  /**
   * 手动刷新金句
   */
  const handleClick = useCallback(() => {
    if (!isTyping) {
      updateQuote();
    }
  }, [isTyping, updateQuote]);

  // 组件初始化时显示第一条金句
  useEffect(() => {
    const initialQuote = getRandomQuote();
    if (initialQuote) {
      setCurrentQuote(initialQuote);
      setIsInitialized(true);
      // 延迟执行动画，确保状态已更新
      setTimeout(() => {
        typewriterEffect(initialQuote);
      }, 50);
    }
  }, []); // 移除依赖项，只在组件挂载时执行一次

  // 每10分钟自动更新金句
  useEffect(() => {
    const interval = setInterval(() => {
      updateQuote();
    }, 10 * 60 * 1000); // 10分钟 = 600,000毫秒

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
      {isInitialized && (
        <div className={`${styles.quoteText} ${isTyping ? styles.typing : ''}`}>
          {displayText || currentQuote}
          {isTyping && <span className={styles.cursor}>|</span>}
        </div>
      )}
    </div>
  );
}

export default MotivationalQuote;