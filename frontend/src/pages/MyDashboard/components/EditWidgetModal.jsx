import React, { useState, useEffect } from 'react';
import { Modal, Button, Radio, DatePicker, Checkbox, Typography, Spin, Select } from 'antd';
import {
  Plus,
  Trash2,
  Check,
  Loader2,
  RotateCw,
  Edit3
} from 'lucide-react';
import dayjs from 'dayjs';
import { DATE_PRESETS, TYPES_WITHOUT_COMPARE } from '../constants.jsx';
import { WIDGET_PRESETS } from '../widgetPresets.jsx';
import axios from 'axios';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const EditWidgetModal = ({ visible, onClose, onSave, widget }) => {
  // 기간 설정
  const [datePresetKey, setDatePresetKey] = useState('last7days');
  const [customDateRange, setCustomDateRange] = useState([dayjs().subtract(6, 'days'), dayjs()]);
  
  // 비교 설정
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareRanges, setCompareRanges] = useState([
    { id: 1, type: 'auto', monthsAgo: 1, customRange: null }
  ]);
  
  // 채널 선택 (channel_funnel 전용)
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channelList, setChannelList] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelError, setChannelError] = useState(null);

  // 위젯 프리셋 정보 조회
  const getPresetInfo = () => {
    if (!widget?.category || !widget?.presetId) return null;
    const categoryPresets = WIDGET_PRESETS[widget.category];
    if (!categoryPresets) return null;
    
    // kpi, chart, list에서 찾기
    for (const section of ['kpi', 'chart', 'list']) {
      const found = categoryPresets[section]?.find(p => p.id === widget.presetId);
      if (found) return found;
    }
    return null;
  };

  // 채널별 전환 퍼널 위젯인지 확인
  const isChannelFunnelWidget = () => {
    return widget?.presetId === 'channel_funnel_chart';
  };

  // 위젯이 변경될 때 초기값 설정
  useEffect(() => {
    if (widget && visible) {
      // 기간 설정 복원
      const presetKey = widget.dateRange?.presetKey || 'last7days';
      setDatePresetKey(presetKey);
      
      if (presetKey === 'custom' && widget.dateRange?.start && widget.dateRange?.end) {
        setCustomDateRange([
          dayjs(widget.dateRange.start),
          dayjs(widget.dateRange.end)
        ]);
      } else {
        const preset = DATE_PRESETS.find(p => p.key === presetKey);
        if (preset && preset.getValue()) {
          setCustomDateRange(preset.getValue());
        }
      }
      
      // 비교 설정 복원
      setCompareEnabled(widget.compareEnabled || false);
      
      if (widget.compareRanges && widget.compareRanges.length > 0) {
        setCompareRanges(widget.compareRanges.map((range, index) => ({
          id: index + 1,
          type: range.type || 'auto',
          monthsAgo: range.monthsAgo || 1,
          customRange: range.type === 'custom' && range.start && range.end
            ? [dayjs(range.start), dayjs(range.end)]
            : null
        })));
      } else {
        setCompareRanges([{ id: 1, type: 'auto', monthsAgo: 1, customRange: null }]);
      }
      
      // 채널 설정 복원
      if (isChannelFunnelWidget()) {
        setSelectedChannel(widget.selectedChannel || null);
        fetchChannelList();
      }
    }
  }, [widget, visible]);

  // 채널 목록 API 호출
  const fetchChannelList = async () => {
    const FALLBACK_CHANNELS = ['Google', 'Naver', 'Meta', '직접 유입', 'Social', 'KakaoTalk', 'Instagram', '기타'];
    
    setLoadingChannels(true);
    setChannelError(null);
    
    try {
      const response = await axios.get('/api/stats/channel-funnel/channels');
      const channels = response.data?.channels || [];
      
      if (channels.length === 0) {
        setChannelList(FALLBACK_CHANNELS);
      } else {
        setChannelList(channels);
      }
    } catch (error) {
      console.error('Failed to fetch channel list:', error);
      setChannelList(FALLBACK_CHANNELS);
    } finally {
      setLoadingChannels(false);
    }
  };

  // 현재 기간 계산
  const getCurrentDateRange = () => {
    if (datePresetKey === 'custom') {
      return customDateRange;
    }
    const preset = DATE_PRESETS.find(p => p.key === datePresetKey);
    return preset ? preset.getValue() : [dayjs().subtract(6, 'days'), dayjs()];
  };

  // 다중 비교 기간 계산
  const getCompareRangesForSave = () => {
    if (!compareEnabled || compareRanges.length === 0) return [];
    const [start, end] = getCurrentDateRange();
    
    return compareRanges.map(range => {
      if (range.type === 'custom' && range.customRange) {
        return {
          start: range.customRange[0].format('YYYY-MM-DD'),
          end: range.customRange[1].format('YYYY-MM-DD'),
          type: 'custom',
          monthsAgo: range.monthsAgo
        };
      }
      // 자동 계산: N달 전
      const compareStart = start.subtract(range.monthsAgo, 'month');
      const compareEnd = end.subtract(range.monthsAgo, 'month');
      return {
        start: compareStart.format('YYYY-MM-DD'),
        end: compareEnd.format('YYYY-MM-DD'),
        type: 'auto',
        monthsAgo: range.monthsAgo
      };
    });
  };

  // 특정 비교 기간의 날짜 범위 계산 (UI 표시용)
  const getCompareRangeDates = (range) => {
    const [start, end] = getCurrentDateRange();
    if (range.type === 'custom' && range.customRange) {
      return range.customRange;
    }
    return [start.subtract(range.monthsAgo, 'month'), end.subtract(range.monthsAgo, 'month')];
  };

  // 비교 기간 추가
  const handleAddCompareRange = () => {
    if (compareRanges.length >= 4) return;
    const nextMonthsAgo = compareRanges.length + 1;
    setCompareRanges([...compareRanges, {
      id: Date.now(),
      type: 'auto',
      monthsAgo: nextMonthsAgo,
      customRange: null
    }]);
  };

  // 비교 기간 삭제
  const handleRemoveCompareRange = (id) => {
    if (compareRanges.length <= 1) return;
    setCompareRanges(compareRanges.filter(r => r.id !== id));
  };

  // 비교 기간 타입 변경
  const handleCompareRangeTypeChange = (id, newType) => {
    setCompareRanges(compareRanges.map(r => 
      r.id === id ? { ...r, type: newType } : r
    ));
  };

  // 비교 기간 커스텀 날짜 변경
  const handleCompareRangeCustomChange = (id, dates) => {
    setCompareRanges(compareRanges.map(r => 
      r.id === id ? { ...r, customRange: dates } : r
    ));
  };

  // 저장 처리
  const handleSave = () => {
    if (!widget) return;
    
    const [startDate, endDate] = getCurrentDateRange();
    const compareRangesForSave = getCompareRangesForSave();
    
    const presetInfo = getPresetInfo();
    
    // 비교 기능을 지원하지 않는 타입이면 강제로 false/빈 배열
    const finalCompareEnabled = presetInfo && TYPES_WITHOUT_COMPARE.includes(presetInfo.type)
      ? false 
      : compareEnabled;
    
    const finalCompareRanges = presetInfo && TYPES_WITHOUT_COMPARE.includes(presetInfo.type)
      ? []
      : compareRangesForSave;
    
    const updatedWidget = {
      ...widget,
      // 기간 설정
      dateRange: {
        start: startDate.format('YYYY-MM-DD'),
        end: endDate.format('YYYY-MM-DD'),
        presetKey: datePresetKey
      },
      compareEnabled: finalCompareEnabled,
      compareRanges: finalCompareRanges,
      // 데이터 초기화 (API 재호출 필요)
      data: null,
      loading: true
    };
    
    // 채널별 전환 퍼널 위젯일 경우 제목 및 채널 업데이트
    if (isChannelFunnelWidget() && selectedChannel) {
      updatedWidget.selectedChannel = selectedChannel;
      updatedWidget.title = `채널별 전환 퍼널 - ${selectedChannel}`;
    }
    
    onSave(updatedWidget);
  };

  // 비교 기능 지원 여부 확인
  const shouldShowCompare = () => {
    const presetInfo = getPresetInfo();
    return presetInfo && !TYPES_WITHOUT_COMPARE.includes(presetInfo.type);
  };

  // 기간별 매출 비교 위젯인지 확인
  const isPeriodRevenueCompare = () => {
    return widget?.presetId === 'period_revenue_compare';
  };

  // 채널 선택 UI 렌더링
  const renderChannelSelection = () => {
    if (loadingChannels) {
      return (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8,
          padding: 16,
          background: '#fafafa',
          borderRadius: 8
        }}>
          <Spin size="small" />
          <Text type="secondary">채널 목록 불러오는 중...</Text>
        </div>
      );
    }

    return (
      <div style={{ 
        padding: 16, 
        border: '1px solid #e8e8e8', 
        borderRadius: 12,
        background: '#fafafa',
        marginBottom: 16
      }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>채널 선택</div>
        <Select
          value={selectedChannel}
          onChange={setSelectedChannel}
          style={{ width: '100%' }}
          placeholder="채널을 선택하세요"
          options={channelList.map(channel => ({
            value: channel,
            label: channel
          }))}
        />
      </div>
    );
  };

  // 기간 설정 UI 렌더링
  const renderDateRangeSection = () => {
    const [currentStart, currentEnd] = getCurrentDateRange();

    return (
      <div style={{ 
        padding: 20, 
        border: '1px solid #e8e8e8', 
        borderRadius: 12, 
        marginBottom: 16,
        background: '#fafafa'
      }}>
        <div style={{ 
          fontWeight: 600, 
          marginBottom: 12, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 16
        }}>
          <span>기간 선택</span>
          {datePresetKey !== 'custom' && currentStart && (
            <span style={{ fontSize: 13, color: '#1890ff', fontWeight: 600 }}>
              {currentStart.format('YYYY-MM-DD')} ~ {currentEnd.format('YYYY-MM-DD')}
            </span>
          )}
        </div>
        <Radio.Group 
          value={datePresetKey} 
          onChange={e => setDatePresetKey(e.target.value)}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
        >
          {DATE_PRESETS.map(preset => (
            <Radio.Button 
              key={preset.key} 
              value={preset.key}
              style={{ borderRadius: 6 }}
            >
              {preset.label}
            </Radio.Button>
          ))}
        </Radio.Group>
        
        {datePresetKey === 'custom' && (
          <div style={{ marginTop: 12 }}>
            <RangePicker
              value={customDateRange}
              onChange={setCustomDateRange}
              format="YYYY-MM-DD"
              style={{ width: '100%' }}
            />
          </div>
        )}
      </div>
    );
  };

  // 비교 설정 UI 렌더링
  const renderCompareSection = () => {
    if (!shouldShowCompare()) return null;

    return (
      <div style={{ 
        padding: 16, 
        border: '1px solid #e8e8e8', 
        borderRadius: 12,
        background: compareEnabled ? '#f6ffed' : '#fafafa'
      }}>
        {/* 비교하기 체크박스 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 16,
          marginBottom: compareEnabled ? 12 : 0 
        }}>
          <Checkbox 
            checked={compareEnabled} 
            onChange={e => setCompareEnabled(e.target.checked)}
          >
            <span style={{ fontWeight: 600 }}>이전 기간과 비교하기</span>
          </Checkbox>
          {/* 자동 계산된 날짜 표시 */}
          {compareEnabled && compareRanges[0]?.type === 'auto' && (
            (() => {
              const [compareStart, compareEnd] = getCompareRangeDates(compareRanges[0]);
              return (
                <span style={{ fontSize: 13, color: '#52c41a', fontWeight: 600 }}>
                  {compareStart.format('YYYY-MM-DD')} ~ {compareEnd.format('YYYY-MM-DD')} 와 비교
                </span>
              );
            })()
          )}
        </div>
        
        {compareEnabled && (
          <>
            {/* 기간별 매출 비교일 때: 다중 비교 UI */}
            {isPeriodRevenueCompare() ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 첫 번째 비교 기간 */}
                {compareRanges.length > 0 && (() => {
                  const firstRange = compareRanges[0];
                  return (
                    <div key={firstRange.id} style={{ marginLeft: 24 }}>
                      <Radio.Group 
                        value={firstRange.type} 
                        onChange={e => handleCompareRangeTypeChange(firstRange.id, e.target.value)}
                        style={{ display: 'flex', flexDirection: 'row', gap: 16 }}
                      >
                        <Radio value="auto">
                          <span>같은 일자의 이전 달 (자동 계산)</span>
                        </Radio>
                        <Radio value="custom">
                          <span>직접 선택</span>
                        </Radio>
                      </Radio.Group>
                      
                      {firstRange.type === 'custom' && (
                        <div style={{ marginTop: 12 }}>
                          <RangePicker
                            value={firstRange.customRange}
                            onChange={(dates) => handleCompareRangeCustomChange(firstRange.id, dates)}
                            format="YYYY-MM-DD"
                            style={{ width: '100%' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}
                
                {/* 2번째 이후 추가 비교 기간들 */}
                {compareRanges.slice(1).map((range, index) => {
                  const [compareStart, compareEnd] = getCompareRangeDates(range);
                  const actualIndex = index + 1;
                  return (
                    <div 
                      key={range.id}
                      style={{ 
                        padding: 12, 
                        background: 'white', 
                        borderRadius: 8,
                        border: '1px solid #e8e8e8',
                        marginLeft: 24
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: 8
                      }}>
                        <span style={{ 
                          fontSize: 13, 
                          fontWeight: 600, 
                          color: '#595959',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}>
                          <span style={{ 
                            width: 20, 
                            height: 20, 
                            borderRadius: '50%', 
                            background: '#d9d9d9',
                            color: 'white',
                            fontSize: 11,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {actualIndex + 1}
                          </span>
                          비교 {actualIndex + 1}
                          {range.type === 'auto' && (
                            <span style={{ color: '#52c41a', fontWeight: 500, fontSize: 12 }}>
                              {compareStart.format('YYYY-MM-DD')} ~ {compareEnd.format('YYYY-MM-DD')}
                            </span>
                          )}
                        </span>
                        <Button 
                          type="text" 
                          size="small"
                          icon={<Trash2 size={16} />}
                          onClick={() => handleRemoveCompareRange(range.id)}
                          style={{ color: '#ff4d4f' }}
                        />
                      </div>
                      
                      <Radio.Group 
                        value={range.type} 
                        onChange={e => handleCompareRangeTypeChange(range.id, e.target.value)}
                        style={{ display: 'flex', gap: 16 }}
                        size="small"
                      >
                        <Radio value="auto">
                          {range.monthsAgo === 1 ? '이전 달 (자동)' : `${range.monthsAgo}달 전 (자동)`}
                        </Radio>
                        <Radio value="custom">직접 선택</Radio>
                      </Radio.Group>
                      
                      {range.type === 'custom' && (
                        <div style={{ marginTop: 8 }}>
                          <RangePicker
                            value={range.customRange}
                            onChange={(dates) => handleCompareRangeCustomChange(range.id, dates)}
                            format="YYYY-MM-DD"
                            style={{ width: '100%' }}
                            size="small"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* 비교할 기간 추가 버튼 */}
                {compareRanges.length < 4 && (
                  <div 
                    onClick={handleAddCompareRange}
                    style={{
                      border: '2px dashed #d9d9d9',
                      borderRadius: 8,
                      padding: '8px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#8c8c8c',
                      background: 'white',
                      transition: 'all 0.2s ease',
                      marginLeft: 24
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#1890ff';
                      e.currentTarget.style.color = '#1890ff';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#d9d9d9';
                      e.currentTarget.style.color = '#8c8c8c';
                    }}
                  >
                    <Plus size={16} style={{ marginRight: 8 }} />
                    비교할 기간 추가 (최대 4개)
                  </div>
                )}
              </div>
            ) : (
              /* 그 외 지표: 단일 비교 기간 UI */
              <div style={{ marginLeft: 24 }}>
                <Radio.Group 
                  value={compareRanges[0]?.type || 'auto'} 
                  onChange={e => handleCompareRangeTypeChange(compareRanges[0]?.id, e.target.value)}
                  style={{ display: 'flex', flexDirection: 'row', gap: 16 }}
                >
                  <Radio value="auto">
                    <span>같은 일자의 이전 달 (자동 계산)</span>
                  </Radio>
                  <Radio value="custom">
                    <span>직접 선택</span>
                  </Radio>
                </Radio.Group>
                
                {compareRanges[0]?.type === 'custom' && (
                  <div style={{ marginTop: 12 }}>
                    <RangePicker
                      value={compareRanges[0]?.customRange}
                      onChange={(dates) => handleCompareRangeCustomChange(compareRanges[0]?.id, dates)}
                      format="YYYY-MM-DD"
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Edit3 size={20} color="#1890ff" />
          <span>위젯 편집</span>
          {widget && (
            <span style={{ 
              fontSize: 13, 
              color: '#8c8c8c', 
              fontWeight: 400,
              marginLeft: 8
            }}>
              - {widget.title}
            </span>
          )}
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={600}
      style={{ top: 40 }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>
            취소
          </Button>
          <Button 
            type="primary" 
            onClick={handleSave}
            icon={<Check size={16} />}
          >
            저장
          </Button>
        </div>
      }
    >
      <div style={{ minHeight: 300 }}>
        {/* 위젯 정보 요약 */}
        <div style={{ 
          padding: 12, 
          background: '#e6f7ff', 
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13
        }}>
          <strong>위젯 타입:</strong> {getPresetInfo()?.label || widget?.title}
        </div>

        {/* 채널 선택 (channel_funnel 전용) */}
        {isChannelFunnelWidget() && renderChannelSelection()}
        
        {/* 기간 설정 */}
        {renderDateRangeSection()}
        
        {/* 비교 설정 */}
        {renderCompareSection()}
        
        {/* 도움말 */}
        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          background: '#fffbe6', 
          borderRadius: 8,
          fontSize: 13,
          color: '#ad8b00'
        }}>
          {isPeriodRevenueCompare() ? (
            <>💡 Tip: 여러 기간을 추가하면 월별 추이를 한눈에 비교할 수 있어요</>
          ) : shouldShowCompare() ? (
            <>💡 Tip: 비교 기간을 설정하면 증감률(%)을 함께 볼 수 있어요</>
          ) : (
            <>💡 Tip: 선택한 기간의 상세 목록을 볼 수 있어요</>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default EditWidgetModal;
