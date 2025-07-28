import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAppState, useAppDispatch } from '../../contexts/AppContext';
import { useTimer } from '../../hooks/useTimer';
import { formatClock } from '../../utils/formatTime';
import { Edit3, Trash2, X, Settings, Check } from 'react-feather';
import styles from './Study.module.css';

/**
 * 晚自习组件
 * 显示当前时间、高考倒计时和作业管理功能
 */
export function Study() {
  const { study } = useAppState();
  const dispatch = useAppDispatch();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [showAddHomework, setShowAddHomework] = useState(false);
  const [editingHomework, setEditingHomework] = useState<string | null>(null);
  const [newHomework, setNewHomework] = useState({
    subject: '',
    content: '',
    estimatedTime: 30
  });
  const [editHomework, setEditHomework] = useState({
    subject: '',
    content: '',
    estimatedTime: 30
  });
  const [targetYear, setTargetYear] = useState(study.targetYear);
  
  // 触摸滑动相关状态
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  /**
   * 更新当前时间
   */
  const updateTime = useCallback(() => {
    setCurrentTime(new Date());
  }, []);

  // 使用计时器每秒更新时间
  useTimer(updateTime, true, 1000);

  // 组件挂载时立即更新时间
  useEffect(() => {
    updateTime();
  }, [updateTime]);

  /**
   * 计算距离高考的天数
   */
  const calculateDaysToGaokao = useCallback(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    let gaokaoDate: Date;
    
    // 如果目标年份是当年，且已经过了6月7日，则计算下一年的高考
    if (study.targetYear === currentYear) {
      const thisYearGaokao = new Date(currentYear, 5, 7); // 6月7日（月份从0开始）
      if (now > thisYearGaokao) {
        gaokaoDate = new Date(currentYear + 1, 5, 7);
      } else {
        gaokaoDate = thisYearGaokao;
      }
    } else {
      gaokaoDate = new Date(study.targetYear, 5, 7);
    }
    
    const diffTime = gaokaoDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [study.targetYear]);

  /**
   * 科目选项
   */// 预设科目 - 按照语数外物化生的顺序
  const subjects = ['语文', '数学', '英语', '物理', '化学', '生物'];

  /**
   * 处理添加作业
   */
  const handleAddHomework = useCallback(() => {
    if (newHomework.subject && newHomework.content) {
      dispatch({
        type: 'ADD_HOMEWORK',
        payload: {
          subject: newHomework.subject,
          content: newHomework.content,
          estimatedTime: newHomework.estimatedTime,
          completed: false
        }
      });
      setNewHomework({ subject: '', content: '', estimatedTime: 30 });
      setShowAddHomework(false);
    }
  }, [newHomework, dispatch]);

  /**
   * 处理编辑作业
   */
  const handleEditHomework = useCallback((id: string) => {
    const homework = study.homeworks.find(hw => hw.id === id);
    if (homework) {
      setEditHomework({
        subject: homework.subject,
        content: homework.content,
        estimatedTime: homework.estimatedTime
      });
      setEditingHomework(id);
    }
  }, [study.homeworks]);

  /**
   * 处理保存编辑
   */
  const handleSaveEdit = useCallback(() => {
    if (editingHomework && editHomework.subject && editHomework.content) {
      dispatch({
        type: 'UPDATE_HOMEWORK',
        payload: {
          id: editingHomework,
          updates: {
            subject: editHomework.subject,
            content: editHomework.content,
            estimatedTime: editHomework.estimatedTime
          }
        }
      });
      setEditingHomework(null);
    }
  }, [editingHomework, editHomework, dispatch]);

  /**
   * 处理取消编辑
   */
  const handleCancelEdit = useCallback(() => {
    setEditingHomework(null);
  }, []);

  /**
   * 处理删除作业
   */
  const handleDeleteHomework = useCallback((id: string) => {
    dispatch({ type: 'DELETE_HOMEWORK', payload: id });
    // 如果删除的是正在编辑的作业，退出编辑状态
    if (editingHomework === id) {
      setEditingHomework(null);
    }
  }, [dispatch, editingHomework]);

  /**
   * 处理触摸开始
   */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
  }, []);

  /**
   * 处理触摸移动
   */
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const currentTouch = e.targetTouches[0].clientY;
    setTouchEnd(currentTouch);
    
    // 阻止默认滚动行为，让我们自己处理滑动
    const distance = Math.abs(touchStart - currentTouch);
    if (distance > 10) {
      e.preventDefault();
    }
  }, [touchStart]);

  /**
   * 处理触摸结束 - 实现上下滑动功能
   */
  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd || !gridRef.current) {
      setTouchStart(null);
      setTouchEnd(null);
      return;
    }
    
    const distance = touchStart - touchEnd;
    const isUpSwipe = distance > 50;
    const isDownSwipe = distance < -50;
    
    if (isUpSwipe || isDownSwipe) {
      const cardHeight = 220; // 估算的卡片高度
      const gap = 24; // 1.5rem = 24px
      const scrollAmount = cardHeight + gap;
      
      if (isUpSwipe) {
        // 向上滑动，显示下一组
        const maxScroll = gridRef.current.scrollHeight - gridRef.current.clientHeight;
        const newPosition = Math.min(scrollPosition + scrollAmount, maxScroll);
        setScrollPosition(newPosition);
        gridRef.current.scrollTo({ top: newPosition, behavior: 'smooth' });
      } else if (isDownSwipe) {
        // 向下滑动，显示上一组
        const newPosition = Math.max(scrollPosition - scrollAmount, 0);
        setScrollPosition(newPosition);
        gridRef.current.scrollTo({ top: newPosition, behavior: 'smooth' });
      }
    }
    
    // 重置触摸状态
    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd, scrollPosition]);



  /**
   * 处理保存目标年份
   */
  const handleSaveTargetYear = useCallback(() => {
    dispatch({ type: 'SET_TARGET_YEAR', payload: targetYear });
    setShowSettings(false);
  }, [targetYear, dispatch]);

  const timeString = formatClock(currentTime);
  const dateString = currentTime.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
  const daysToGaokao = calculateDaysToGaokao();
  const totalCount = study.homeworks.length;

  return (
    <div className={styles.study}>
      {/* 顶部信息栏 */}
      <div className={styles.header}>
        <div className={styles.timeInfo}>
          <div className={styles.currentTime}>{timeString}</div>
          <div className={styles.currentDate}>{dateString}</div>
        </div>
        <div className={styles.gaokaoInfo}>
          <div className={styles.gaokaoCountdown}>
            距离{study.targetYear}年高考还有 <span className={styles.days}>{daysToGaokao}</span> 天
          </div>
          <button 
            className={styles.settingsButton}
            onClick={() => setShowSettings(true)}
            title="设置目标年份"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* 作业管理区域 */}
      <div className={styles.homeworkSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>今日作业</h2>
          <div className={styles.headerRight}>
            <div className={styles.progress}>
              共 {totalCount} 项作业
            </div>
            <div className={styles.swipeHint}>↑ 滑动浏览 ↓</div>
          </div>
        </div>

        <div 
          className={styles.homeworkGrid}
          ref={gridRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {subjects.map((subject) => {
            const subjectHomeworks = study.homeworks.filter(hw => hw.subject === subject);
            
            return (
              <div 
                key={subject} 
                className={styles.homeworkCard}
                onClick={() => {
                  setNewHomework(prev => ({ ...prev, subject }));
                  setShowAddHomework(true);
                }}
                title={`点击添加${subject}作业`}
              >
                <div className={styles.cardHeader}>
                  <h3 className={styles.subjectTitle}>{subject}</h3>
                </div>
                
                <div className={styles.cardContent}>
                  {subjectHomeworks.length === 0 ? (
                    <div className={styles.emptyHomework}>
                      暂无作业
                    </div>
                  ) : (
                    <div className={styles.homeworkList}>
                      {subjectHomeworks.map((homework) => (
                        <div 
                          key={homework.id} 
                          className={styles.homeworkItem}
                          onClick={(e) => {
                            e.stopPropagation();
                            // 如果当前不在编辑状态，则进入编辑状态
                            if (editingHomework !== homework.id) {
                              handleEditHomework(homework.id);
                            }
                          }}
                          title="点击编辑作业"
                        >
                          {editingHomework === homework.id ? (
                            <div className={styles.editForm}>
                              <textarea
                                value={editHomework.content}
                                onChange={(e) => setEditHomework(prev => ({ ...prev, content: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.stopPropagation();
                                  }
                                }}
                                placeholder="作业内容"
                                className={styles.contentTextarea}
                                rows={3}
                              />
                              <input
                                type="number"
                                value={editHomework.estimatedTime}
                                onChange={(e) => setEditHomework(prev => ({ ...prev, estimatedTime: parseInt(e.target.value) || 0 }))}
                                placeholder="预估时间(分钟)"
                                className={styles.timeInput}
                                min="1"
                              />
                              <div className={styles.editActions}>
                                <button onClick={handleSaveEdit} className={styles.saveButton}>
                                  <Check size={14} />
                                </button>
                                <button onClick={handleCancelEdit} className={styles.cancelButton}>
                                  <X size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteHomework(homework.id)}
                                  className={styles.deleteButton}
                                  title="删除作业"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className={styles.homeworkContent}>
                              <div className={styles.content}>{homework.content}</div>
                              <div className={styles.estimatedTime}>{homework.estimatedTime}分钟</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 添加作业模态框 */}
      {showAddHomework && (
        <div className={styles.modal} onClick={() => setShowAddHomework(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>添加作业</h3>
              <button onClick={() => setShowAddHomework(false)} className={styles.closeButton}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.selectedSubject}>
                <span className={styles.subjectLabel}>科目：</span>
                <span className={styles.subjectName}>{newHomework.subject}</span>
              </div>
              <textarea
                value={newHomework.content}
                onChange={(e) => setNewHomework(prev => ({ ...prev, content: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.stopPropagation();
                  }
                }}
                placeholder="作业内容（支持多行输入）"
                className={styles.contentTextarea}
                rows={4}
              />
              <input
                type="number"
                value={newHomework.estimatedTime}
                onChange={(e) => setNewHomework(prev => ({ ...prev, estimatedTime: parseInt(e.target.value) || 0 }))}
                placeholder="预估时间(分钟)"
                className={styles.timeInput}
                min="1"
              />
            </div>
            <div className={styles.modalActions}>
              <button onClick={() => setShowAddHomework(false)} className={styles.cancelButton}>
                取消
              </button>
              <button 
                onClick={handleAddHomework} 
                className={styles.confirmButton}
                disabled={!newHomework.subject || !newHomework.content}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 设置目标年份模态框 */}
      {showSettings && (
        <div className={styles.modal} onClick={() => setShowSettings(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>设置目标高考年份</h3>
              <button onClick={() => setShowSettings(false)} className={styles.closeButton}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <input
                type="number"
                value={targetYear}
                onChange={(e) => setTargetYear(parseInt(e.target.value) || new Date().getFullYear())}
                className={styles.yearInput}
                min={new Date().getFullYear()}
                max={new Date().getFullYear() + 10}
              />
            </div>
            <div className={styles.modalActions}>
              <button onClick={() => setShowSettings(false)} className={styles.cancelButton}>
                取消
              </button>
              <button onClick={handleSaveTargetYear} className={styles.confirmButton}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}