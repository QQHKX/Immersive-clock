import React, { useState, useCallback, useEffect } from 'react';
import { PlusIcon, TrashIcon, SaveIcon } from '../Icons';
import { StudyPeriod, DEFAULT_SCHEDULE } from '../StudyStatus';
import { Modal } from '../Modal';
import { FormSection, FormInput, FormButton, FormButtonGroup, FormRow } from '../FormComponents';
import styles from './ScheduleSettings.module.css';
import { readStudySchedule, writeStudySchedule } from '../../utils/studyScheduleStorage';

interface ScheduleSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: StudyPeriod[]) => void;
}

/**
 * 课程表配置组件
 * 功能：支持添加、修改、删除上课时间段
 */
const ScheduleSettings: React.FC<ScheduleSettingsProps> = ({ isOpen, onClose, onSave }) => {
  const [schedule, setSchedule] = useState<StudyPeriod[]>(DEFAULT_SCHEDULE);
  const [editingId, setEditingId] = useState<string | null>(null);

  /**
   * 从localStorage加载课程表
   */
  const loadSchedule = useCallback(() => {
    const data = readStudySchedule();
    setSchedule(Array.isArray(data) && data.length > 0 ? data : DEFAULT_SCHEDULE);
  }, []);

  /**
   * 保存课程表到localStorage
   */
  const saveSchedule = useCallback((newSchedule: StudyPeriod[]) => {
    try {
      writeStudySchedule(newSchedule);
      onSave(newSchedule);
    } catch (error) {
      console.error('保存课程表失败:', error);
    }
  }, [onSave]);

  /**
   * 按开始时间排序课程表
   */
  const sortSchedule = useCallback((periods: StudyPeriod[]): StudyPeriod[] => {
    return [...periods].sort((a, b) => {
      const timeA = parseInt(a.startTime.replace(':', ''));
      const timeB = parseInt(b.startTime.replace(':', ''));
      return timeA - timeB;
    });
  }, []);

  /**
   * 添加新的时间段
   */
  const handleAddPeriod = useCallback(() => {
    const newPeriod: StudyPeriod = {
      id: Date.now().toString(),
      startTime: '19:00',
      endTime: '20:00',
      name: `第${schedule.length + 1}节晚自习`
    };
    const newSchedule = sortSchedule([...schedule, newPeriod]);
    setSchedule(newSchedule);
    setEditingId(newPeriod.id);
  }, [schedule, sortSchedule]);

  /**
   * 删除时间段
   */
  const handleDeletePeriod = useCallback((id: string) => {
    const newSchedule = schedule.filter(period => period.id !== id);
    setSchedule(newSchedule);
    if (editingId === id) {
      setEditingId(null);
    }
  }, [schedule, editingId]);

  /**
   * 更新时间段
   */
  const handleUpdatePeriod = useCallback((id: string, field: keyof StudyPeriod, value: string) => {
    const newSchedule = schedule.map(period => {
      if (period.id === id) {
        return { ...period, [field]: value };
      }
      return period;
    });
    setSchedule(sortSchedule(newSchedule));
  }, [schedule, sortSchedule]);

  /**
   * 验证时间格式
   */
  const isValidTime = useCallback((time: string): boolean => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }, []);

  /**
   * 验证时间段是否有效
   */
  const isValidPeriod = useCallback((period: StudyPeriod): boolean => {
    if (!isValidTime(period.startTime) || !isValidTime(period.endTime)) {
      return false;
    }
    const startMinutes = parseInt(period.startTime.replace(':', ''));
    const endMinutes = parseInt(period.endTime.replace(':', ''));
    return startMinutes < endMinutes;
  }, [isValidTime]);

  /**
   * 保存并关闭
   */
  const handleSave = useCallback(() => {
    // 验证所有时间段
    const validSchedule = schedule.filter(period => isValidPeriod(period));
    if (validSchedule.length === 0) {
      alert('请至少添加一个有效的时间段');
      return;
    }
    
    const sortedSchedule = sortSchedule(validSchedule);
    setSchedule(sortedSchedule);
    saveSchedule(sortedSchedule);
    onClose();
  }, [schedule, isValidPeriod, sortSchedule, saveSchedule, onClose]);

  /**
   * 重置为默认课程表
   */
  const handleReset = useCallback(() => {
    if (confirm('确定要重置为默认课程表吗？')) {
      setSchedule(DEFAULT_SCHEDULE);
      setEditingId(null);
    }
  }, []);

  // 组件打开时加载课程表
  useEffect(() => {
    if (isOpen) {
      loadSchedule();
    }
  }, [isOpen, loadSchedule]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="课程表设置"
      maxWidth="lg"
      footer={
        <FormButtonGroup align="left">
          <FormButton
            variant="secondary"
            onClick={handleReset}
          >
            重置默认
          </FormButton>
          <FormButtonGroup>
            <FormButton
              variant="secondary"
              onClick={onClose}
            >
              取消
            </FormButton>
            <FormButton
              variant="primary"
              onClick={handleSave}
              icon={<SaveIcon size={16} />}
            >
              保存
            </FormButton>
          </FormButtonGroup>
        </FormButtonGroup>
      }
    >
      <FormSection title="课程时间表">
        <div className={styles.scheduleList}>
          {schedule.map((period, index) => (
            <div key={period.id} className={styles.periodItem}>
              <div className={styles.periodNumber}>{index + 1}</div>
              <div className={styles.periodInputs}>
                <FormInput
                  type="text"
                  value={period.name}
                  onChange={(e) => handleUpdatePeriod(period.id, 'name', e.target.value)}
                  placeholder="课程名称"
                />
                <FormRow gap="sm">
                  <FormInput
                    type="time"
                    value={period.startTime}
                    onChange={(e) => handleUpdatePeriod(period.id, 'startTime', e.target.value)}
                    variant={!isValidTime(period.startTime) ? 'default' : 'time'}
                  />
                  <span className={styles.timeSeparator}>-</span>
                  <FormInput
                    type="time"
                    value={period.endTime}
                    onChange={(e) => handleUpdatePeriod(period.id, 'endTime', e.target.value)}
                    variant={!isValidTime(period.endTime) ? 'default' : 'time'}
                  />
                </FormRow>
              </div>
              <FormButton
                variant="danger"
                size="sm"
                onClick={() => handleDeletePeriod(period.id)}
                icon={<TrashIcon size={16} />}
                title="删除时间段"
              />
            </div>
          ))}
        </div>
          
        <FormButtonGroup align="center">
          <FormButton
            variant="primary"
            onClick={handleAddPeriod}
            icon={<PlusIcon size={16} />}
          >
            添加时间段
          </FormButton>
        </FormButtonGroup>
      </FormSection>
    </Modal>
  );
};

export default ScheduleSettings;