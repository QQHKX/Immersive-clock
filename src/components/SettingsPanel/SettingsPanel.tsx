import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAppState, useAppDispatch } from '../../contexts/AppContext';
import { Modal } from '../Modal';
import { FormButton, FormButtonGroup } from '../FormComponents';
import { Tabs } from '../Tabs/Tabs';
import styles from './SettingsPanel.module.css';
import BasicSettingsPanel from './sections/BasicSettingsPanel';
import StudySettingsPanel from './sections/StudySettingsPanel';
import ContentSettingsPanel from './sections/ContentSettingsPanel';

// 分区逻辑已拆分到子组件中

/**
 * 设置面板属性
 * - `isOpen`：是否显示设置面板
 * - `onClose`：关闭面板的回调
 */
interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 设置面板组件
 * 提供目标年份设置和课程表管理功能
 */
/**
 * 设置面板主组件
 * 将基础设置、学习功能与内容管理分区委托给子组件，
 * 保留目标年份持久化与选项卡切换逻辑。
 */
export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { study } = useAppState();
  const dispatch = useAppDispatch();
  
  const [activeCategory, setActiveCategory] = useState<'basic' | 'study' | 'content'>('basic');
  const [targetYear, setTargetYear] = useState(study.targetYear);
  // 其余状态由子组件管理
  // 分区保存注册
  const basicSaveRef = useRef<() => void>(() => {});
  const studySaveRef = useRef<() => void>(() => {});
  const contentSaveRef = useRef<() => void>(() => {});
  
  // 其余逻辑由子组件管理

  /**
   * 保存所有设置
   */
  const handleSaveAll = useCallback(() => {
    // 保存目标年份（仅在高考模式下生效，但统一持久化）
    dispatch({ type: 'SET_TARGET_YEAR', payload: targetYear });
    // 统一调用各分区的保存逻辑
    try {
      basicSaveRef.current?.();
      studySaveRef.current?.();
      contentSaveRef.current?.();
    } catch (e) {
      console.error('保存分区设置失败:', e);
      alert('保存设置时出现错误，请重试');
      return;
    }
    // 关闭设置面板
    onClose();
  }, [targetYear, dispatch, onClose]);
  
  // 已移除：设置面板的噪音与天气处理，由子组件负责
  
  // 组件打开时加载数据
  useEffect(() => {
    if (isOpen) {
      setTargetYear(study.targetYear);
      // 打开时默认显示基础设置
      setActiveCategory('basic');
    }
  }, [isOpen, study.targetYear]);
  
  if (!isOpen) return null;
  
  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title="设置" 
        maxWidth="lg"
        footer={
          <FormButtonGroup align="right">
            <FormButton variant="secondary" onClick={onClose}>
              取消
            </FormButton>
            <FormButton variant="primary" onClick={handleSaveAll}>
              保存
            </FormButton>
          </FormButtonGroup>
        }
      >
        <div className={styles.settingsContainer}>
        {/* 顶部分类选项卡 */}
        <Tabs
          items={[
            { key: 'basic', label: '基础设置' },
            { key: 'study', label: '学习功能' },
            { key: 'content', label: '内容管理' }
          ]}
          activeKey={activeCategory}
          onChange={(key) => setActiveCategory(key as 'basic' | 'study' | 'content')}
          variant="browser"
          size="md"
          scrollable
        />

        {/* 基础设置区域 */}
        {activeCategory === 'basic' && (
          <BasicSettingsPanel 
            targetYear={targetYear} 
            onTargetYearChange={setTargetYear}
            onRegisterSave={(fn) => { basicSaveRef.current = fn; }}
          />
        )}

        {/* 学习功能区域 */}
        {activeCategory === 'study' && (
          <StudySettingsPanel onRegisterSave={(fn) => { studySaveRef.current = fn; }} />
        )}

        {/* 内容管理区域 */}
        {activeCategory === 'content' && (
          <ContentSettingsPanel onRegisterSave={(fn) => { contentSaveRef.current = fn; }} />
        )}
        </div>
      </Modal>
      {/* 已移除：设置面板内的开发者测试噪音报告弹窗挂载 */}
    </>
  );
}