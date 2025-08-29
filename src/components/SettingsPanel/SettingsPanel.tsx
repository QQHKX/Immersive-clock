import React, { useState, useCallback, useEffect } from 'react';
import { X, Plus, Trash2, Save, Settings } from 'react-feather';
import { useAppState, useAppDispatch } from '../../contexts/AppContext';
import { StudyPeriod, DEFAULT_SCHEDULE } from '../StudyStatus';
import styles from './SettingsPanel.module.css';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 统一设置面板组件
 * 整合所有晚自习相关的配置选项
 */
export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { study } = useAppState();
  const dispatch = useAppDispatch();
  
  // 目标年份设置
  const [targetYear, setTargetYear] = useState(study.targetYear);
  
  // 课程表设置
  const [schedule, setSchedule] = useState<StudyPeriod[]>(DEFAULT_SCHEDULE);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  /**
   * 从localStorage加载课程表
   */
  const loadSchedule = useCallback(() => {
    try {
      const savedSchedule = localStorage.getItem('study-schedule');
      if (savedSchedule) {
        const parsed = JSON.parse(savedSchedule);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSchedule(parsed);
          return;
        }
      }
    } catch (error) {
      console.error('加载课程表失败:', error);
    }
    setSchedule(DEFAULT_SCHEDULE);
  }, []);
  
  /**
   * 保存课程表到localStorage
   */
  const saveSchedule = useCallback((newSchedule: StudyPeriod[]) => {
    try {
      localStorage.setItem('study-schedule', JSON.stringify(newSchedule));
    } catch (error) {
      console.error('保存课程表失败:', error);
    }
  }, []);
  
  /**
   * 验证时间格式
   */
  const isValidTime = useCallback((time: string): boolean => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }, []);
  
  /**
   * 验证时间段
   */
  const isValidPeriod = useCallback((period: StudyPeriod): boolean => {
    if (!period.name.trim() || !isValidTime(period.startTime) || !isValidTime(period.endTime)) {
      return false;
    }
    const startMinutes = parseInt(period.startTime.replace(':', ''));
    const endMinutes = parseInt(period.endTime.replace(':', ''));
    return startMinutes < endMinutes;
  }, [isValidTime]);
  
  /**
   * 添加新时间段
   */
  const handleAddPeriod = useCallback(() => {
    const newPeriod: StudyPeriod = {
      id: Date.now().toString(),
      startTime: '19:00',
      endTime: '20:00',
      name: '新时间段'
    };
    setSchedule(prev => [...prev, newPeriod]);
    setEditingId(newPeriod.id);
  }, []);
  
  /**
   * 删除时间段
   */
  const handleDeletePeriod = useCallback((id: string) => {
    setSchedule(prev => prev.filter(period => period.id !== id));
    if (editingId === id) {
      setEditingId(null);
    }
  }, [editingId]);
  
  /**
   * 更新时间段
   */
  const handleUpdatePeriod = useCallback((id: string, field: keyof StudyPeriod, value: string) => {
    setSchedule(prev => prev.map(period => 
      period.id === id ? { ...period, [field]: value } : period
    ));
  }, []);
  
  /**
   * 保存所有设置
   */
  const handleSaveAll = useCallback(() => {
    // 保存目标年份
    dispatch({ type: 'SET_TARGET_YEAR', payload: targetYear });
    
    // 验证并保存课程表
    const validSchedule = schedule.filter(period => isValidPeriod(period));
    if (validSchedule.length === 0) {
      alert('请至少添加一个有效的时间段');
      return;
    }
    
    // 按开始时间排序
    const sortedSchedule = [...validSchedule].sort((a, b) => {
      const timeA = parseInt(a.startTime.replace(':', ''));
      const timeB = parseInt(b.startTime.replace(':', ''));
      return timeA - timeB;
    });
    
    setSchedule(sortedSchedule);
    saveSchedule(sortedSchedule);
    
    onClose();
  }, [targetYear, schedule, isValidPeriod, saveSchedule, dispatch, onClose]);
  
  /**
   * 重置课程表
   */
  const handleResetSchedule = useCallback(() => {
    if (confirm('确定要重置为默认课程表吗？')) {
      setSchedule(DEFAULT_SCHEDULE);
      setEditingId(null);
    }
  }, []);
  
  // 组件打开时加载数据
  useEffect(() => {
    if (isOpen) {
      setTargetYear(study.targetYear);
      loadSchedule();
    }
  }, [isOpen, study.targetYear, loadSchedule]);
  
  if (!isOpen) return null;
  
  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>设置</h3>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={20} />
          </button>
        </div>
        
        <div className={styles.modalBody}>
          {/* 目标年份设置 */}
          <div className={styles.section}>
            <h4>目标高考年份</h4>
            <div className={styles.yearSetting}>
              <input
                type="number"
                value={targetYear}
                onChange={(e) => setTargetYear(parseInt(e.target.value) || new Date().getFullYear())}
                className={styles.yearInput}
                min={new Date().getFullYear()}
                max={new Date().getFullYear() + 10}
              />
            </div>
          </div>
          
          {/* 课程表设置 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h4>课程表设置</h4>
              <div className={styles.sectionActions}>
                <button onClick={handleResetSchedule} className={styles.resetButton}>
                  重置
                </button>
                <button onClick={handleAddPeriod} className={styles.addButton}>
                  <Plus size={16} />
                  添加
                </button>
              </div>
            </div>
            
            <div className={styles.scheduleList}>
              {schedule.map((period) => (
                <div key={period.id} className={styles.periodItem}>
                  {editingId === period.id ? (
                    <div className={styles.editForm}>
                      <input
                        type="text"
                        value={period.name}
                        onChange={(e) => handleUpdatePeriod(period.id, 'name', e.target.value)}
                        className={styles.nameInput}
                        placeholder="课程名称"
                      />
                      <input
                        type="time"
                        value={period.startTime}
                        onChange={(e) => handleUpdatePeriod(period.id, 'startTime', e.target.value)}
                        className={styles.timeInput}
                      />
                      <span className={styles.timeSeparator}>-</span>
                      <input
                        type="time"
                        value={period.endTime}
                        onChange={(e) => handleUpdatePeriod(period.id, 'endTime', e.target.value)}
                        className={styles.timeInput}
                      />
                      <div className={styles.editActions}>
                        <button
                          onClick={() => setEditingId(null)}
                          className={styles.saveButton}
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={() => handleDeletePeriod(period.id)}
                          className={styles.deleteButton}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.periodDisplay} onClick={() => setEditingId(period.id)}>
                      <div className={styles.periodInfo}>
                        <span className={styles.periodName}>{period.name}</span>
                        <span className={styles.periodTime}>
                          {period.startTime} - {period.endTime}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className={styles.modalActions}>
          <button onClick={onClose} className={styles.cancelButton}>
            取消
          </button>
          <button onClick={handleSaveAll} className={styles.confirmButton}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}