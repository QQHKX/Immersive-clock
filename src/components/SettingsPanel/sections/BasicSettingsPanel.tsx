import React, { useCallback, useEffect, useState } from 'react';
import { useAppState, useAppDispatch } from '../../../contexts/AppContext';
import { FormSection, FormInput, FormSegmented, FormButton, FormButtonGroup } from '../../FormComponents';
import { RefreshIcon } from '../../Icons';
import styles from '../SettingsPanel.module.css';

/**
 * 基础设置分段组件的属性
 * - `targetYear`：目标高考年份
 * - `onTargetYearChange`：更新目标年份的回调
 */
export interface BasicSettingsPanelProps {
  targetYear: number;
  onTargetYearChange: (year: number) => void;
  onRegisterSave?: (fn: () => void) => void;
}

/**
 * 基础设置分段组件
 * - 倒计时类型与目标年份/自定义事件设置
 * - 天气信息展示与刷新
 */
/**
 * 基础设置分段组件
 * - 倒计时类型与目标年份/自定义事件设置
 * - 天气信息展示与刷新
 */
export const BasicSettingsPanel: React.FC<BasicSettingsPanelProps> = ({ targetYear, onTargetYearChange, onRegisterSave }) => {
  const { study } = useAppState();
  const dispatch = useAppDispatch();

  // 天气增强：地址、刷新状态、最后成功时间
  const [weatherAddress, setWeatherAddress] = useState<string>(() => localStorage.getItem('weather.address') || '');
  const [weatherRefreshStatus, setWeatherRefreshStatus] = useState<string>(() => localStorage.getItem('weather.refreshStatus') || '');
  const [weatherLastTs, setWeatherLastTs] = useState<number>(() => parseInt(localStorage.getItem('weather.lastSuccessTs') || '0', 10));

  // 倒计时设置草稿
  const [draftCountdownType, setDraftCountdownType] = useState<'gaokao' | 'custom'>(study.countdownType ?? 'gaokao');
  const [draftCustomName, setDraftCustomName] = useState<string>(study.customName ?? '');
  const [draftCustomDate, setDraftCustomDate] = useState<string>(study.customDate ?? '');

  const handleRefreshWeather = useCallback(() => {
    const weatherRefreshEvent = new CustomEvent('weatherRefresh');
    window.dispatchEvent(weatherRefreshEvent);
    setWeatherRefreshStatus('刷新中');
    localStorage.setItem('weather.refreshStatus', '刷新中');
  }, []);

  useEffect(() => {
    // 同步草稿为当前应用状态（打开面板或刷新时）
    setDraftCountdownType(study.countdownType ?? 'gaokao');
    setDraftCustomName(study.customName ?? '');
    setDraftCustomDate(study.customDate ?? '');

    const onDone = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const status = detail.status || localStorage.getItem('weather.refreshStatus') || '';
      const address = detail.address || localStorage.getItem('weather.address') || '';
      const ts = detail.ts || parseInt(localStorage.getItem('weather.lastSuccessTs') || '0', 10);
      setWeatherRefreshStatus(status);
      setWeatherAddress(address);
      if (status === '成功') setWeatherLastTs(ts);
    };
    window.addEventListener('weatherRefreshDone', onDone as EventListener);
    return () => window.removeEventListener('weatherRefreshDone', onDone as EventListener);
  }, [study.countdownType, study.customName, study.customDate]);

  // 注册保存动作：统一在父组件保存时派发
  useEffect(() => {
    onRegisterSave?.(() => {
      dispatch({ type: 'SET_COUNTDOWN_TYPE', payload: draftCountdownType });
      if (draftCountdownType === 'custom') {
        dispatch({ type: 'SET_CUSTOM_COUNTDOWN', payload: { name: draftCustomName, date: draftCustomDate } });
      }
    });
  }, [onRegisterSave, draftCountdownType, draftCustomName, draftCustomDate, dispatch]);

  return (
    <div className={styles.settingsGroup} id="basic-panel" role="tabpanel" aria-labelledby="basic">
      <h3 className={styles.groupTitle}>基础设置</h3>
      <FormSection title="倒计时设置">
        <p className={styles.helpText}>
          选择倒计时类型。高考模式默认使用最近一年高考日期；自定义模式可设置事件名称与日期。
        </p>
        <FormSegmented
          label="倒计时类型"
          value={draftCountdownType}
          options={[
            { label: '高考倒计时', value: 'gaokao' },
            { label: '自定义事件', value: 'custom' },
          ]}
          onChange={(value) => {
            setDraftCountdownType(value as 'gaokao' | 'custom');
          }}
        />

        {draftCountdownType === 'gaokao' ? (
          <FormInput
            label="目标高考年份"
            type="number"
            value={targetYear.toString()}
            onChange={(e) => onTargetYearChange(parseInt(e.target.value) || new Date().getFullYear())}
            variant="number"
            min={new Date().getFullYear()}
            max={new Date().getFullYear() + 10}
          />
        ) : (
          <>
            <FormInput
              label="事件名称"
              type="text"
              value={draftCustomName}
              onChange={(e) => setDraftCustomName(e.target.value)}
              placeholder="例如：期末考试"
            />
            <FormInput
              label="事件日期"
              type="date"
              value={draftCustomDate}
              onChange={(e) => setDraftCustomDate(e.target.value)}
            />
          </>
        )}
      </FormSection>

      <FormSection title="天气设置">
        <div className={styles.weatherInfo}>
          <p className={styles.infoText}>手动刷新天气数据以获取最新的天气信息。</p>
          <p className={styles.infoText}>定位坐标：{(() => {
            const lat = localStorage.getItem('weather.coords.lat');
            const lon = localStorage.getItem('weather.coords.lon');
            return lat && lon ? `${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}` : '未获取';
          })()}</p>
          <p className={styles.infoText}>定位方式：{(() => {
            const source = localStorage.getItem('weather.coords.source');
            if (!source) return '未获取';
            if (source === 'geolocation') return '浏览器定位';
            if (source === 'amap_ip') return '高德IP定位';
            if (source === 'ip') return '公共IP定位';
            return source;
          })()}</p>
          <p className={styles.infoText}>街道地址：{weatherAddress || '未获取'}</p>
          <p className={styles.infoText}>时间：{localStorage.getItem('weather.now.obsTime') || '未获取'}</p>
          <p className={styles.infoText}>天气：{localStorage.getItem('weather.now.text') || '未获取'}</p>
          <p className={styles.infoText}>气温：{localStorage.getItem('weather.now.temp') ? `${localStorage.getItem('weather.now.temp')}°C` : '未获取'}  体感：{localStorage.getItem('weather.now.feelsLike') ? `${localStorage.getItem('weather.now.feelsLike')}°C` : '未获取'}</p>
          <p className={styles.infoText}>风向：{localStorage.getItem('weather.now.windDir') || '未获取'}  风力：{localStorage.getItem('weather.now.windScale') || '未获取'}  风速：{localStorage.getItem('weather.now.windSpeed') ? `${localStorage.getItem('weather.now.windSpeed')} km/h` : '未获取'}</p>
          <p className={styles.infoText}>湿度：{localStorage.getItem('weather.now.humidity') ? `${localStorage.getItem('weather.now.humidity')}%` : '未获取'}  气压：{localStorage.getItem('weather.now.pressure') ? `${localStorage.getItem('weather.now.pressure')} hPa` : '未获取'}</p>
          <p className={styles.infoText}>降水：{localStorage.getItem('weather.now.precip') ? `${localStorage.getItem('weather.now.precip')} mm` : '未获取'}  能见度：{localStorage.getItem('weather.now.vis') ? `${localStorage.getItem('weather.now.vis')} km` : '未获取'}  云量：{localStorage.getItem('weather.now.cloud') || '未获取'}</p>
          <p className={styles.infoText}>露点：{localStorage.getItem('weather.now.dew') || '未获取'}</p>
          <p className={styles.infoText}>数据源：{(() => {
            const sources = localStorage.getItem('weather.refer.sources');
            return sources ? 'QWeather' : '未获取';
          })()}</p>
          <p className={styles.infoText}>许可：{(() => {
            const license = localStorage.getItem('weather.refer.license');
            return license ? 'QWeather Developers License' : '未获取';
          })()}</p>
          <p className={styles.infoText}>刷新状态：{weatherRefreshStatus || '未刷新'}</p>
          <p className={styles.infoText}>最后成功时间：{weatherLastTs > 0 ? new Date(weatherLastTs).toLocaleString() : '未成功'}</p>
        </div>

        <FormButtonGroup align="left">
          <FormButton
            variant="secondary"
            onClick={handleRefreshWeather}
            icon={<RefreshIcon size={16} />}
          >
            刷新天气
          </FormButton>
        </FormButtonGroup>
      </FormSection>
    </div>
  );
};

export default BasicSettingsPanel;