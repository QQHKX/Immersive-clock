import React, { useState, useCallback, useEffect } from 'react';
import { useAppState, useAppDispatch } from '../../contexts/AppContext';
import { useTimer } from '../../hooks/useTimer';
import { formatClock } from '../../utils/formatTime';
import { Plus, Edit3, Trash2, Check, X, Settings } from 'react-feather';
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
   */
  const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理'];

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
  }, [dispatch]);

  /**
   * 处理切换作业完成状态
   */
  const handleToggleHomework = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_HOMEWORK', payload: id });
  }, [dispatch]);

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
  const completedCount = study.homeworks.filter(hw => hw.completed).length;
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
          <div className={styles.progress}>
            已完成 {completedCount}/{totalCount}
          </div>
          <button 
            className={styles.addButton}
            onClick={() => setShowAddHomework(true)}
            title="添加作业"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className={styles.homeworkList}>
          {study.homeworks.map((homework) => (
            <div 
              key={homework.id} 
              className={`${styles.homeworkItem} ${homework.completed ? styles.completed : ''}`}
            >
              {editingHomework === homework.id ? (
                <div className={styles.editForm}>
                  <select
                    value={editHomework.subject}
                    onChange={(e) => setEditHomework(prev => ({ ...prev, subject: e.target.value }))}
                    className={styles.subjectSelect}
                  >
                    <option value="">选择科目</option>
                    {subjects.map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={editHomework.content}
                    onChange={(e) => setEditHomework(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="作业内容"
                    className={styles.contentInput}
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
                      <Check size={16} />
                    </button>
                    <button onClick={handleCancelEdit} className={styles.cancelButton}>
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.homeworkContent}>
                    <div className={styles.subjectTag}>{homework.subject}</div>
                    <div className={styles.content}>{homework.content}</div>
                    <div className={styles.estimatedTime}>{homework.estimatedTime}分钟</div>
                  </div>
                  <div className={styles.homeworkActions}>
                    <button 
                      onClick={() => handleToggleHomework(homework.id)}
                      className={`${styles.toggleButton} ${homework.completed ? styles.completed : ''}`}
                      title={homework.completed ? '标记为未完成' : '标记为已完成'}
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      onClick={() => handleEditHomework(homework.id)}
                      className={styles.editButton}
                      title="编辑作业"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteHomework(homework.id)}
                      className={styles.deleteButton}
                      title="删除作业"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          
          {study.homeworks.length === 0 && (
            <div className={styles.emptyState}>
              还没有添加作业，点击右上角的 + 号开始添加吧！
            </div>
          )}
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
              <select
                value={newHomework.subject}
                onChange={(e) => setNewHomework(prev => ({ ...prev, subject: e.target.value }))}
                className={styles.subjectSelect}
              >
                <option value="">选择科目</option>
                {subjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
              <input
                type="text"
                value={newHomework.content}
                onChange={(e) => setNewHomework(prev => ({ ...prev, content: e.target.value }))}
                placeholder="作业内容"
                className={styles.contentInput}
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