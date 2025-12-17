import React, { useState, useEffect } from 'react';
import { Modal, Steps, Button, Radio, DatePicker, Checkbox, Typography, Spin } from 'antd';
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  Lock,
  Loader2,
  RotateCw
} from 'lucide-react';
import dayjs from 'dayjs';
import { DATA_SOURCES, DATE_PRESETS, TYPES_WITHOUT_COMPARE } from '../constants.jsx';
import { WIDGET_PRESETS } from '../widgetPresets.jsx';
import axios from 'axios';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const AddWidgetModal = ({ visible, onClose, onAdd, globalDateRange }) => {
  // Step 관리
  const [currentStep, setCurrentStep] = useState(0);
  
  // Step 1: 카테고리 선택
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Step 2: 지표 선택
  const [selectedPreset, setSelectedPreset] = useState(null);
  
  // Step 3: 채널 선택 (채널별 전환 퍼널만)
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channelList, setChannelList] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelError, setChannelError] = useState(null);
  const [channelRetryCount, setChannelRetryCount] = useState(0);
  
  // Step 4 (또는 Step 3): 기간 설정
  const [datePresetKey, setDatePresetKey] = useState('last7days');
  const [customDateRange, setCustomDateRange] = useState([dayjs().subtract(6, 'days'), dayjs()]);
  const [compareEnabled, setCompareEnabled] = useState(true);
  // 다중 비교 기간 (최대 4개)
  const [compareRanges, setCompareRanges] = useState([
    { id: 1, type: 'auto', monthsAgo: 1, customRange: null }
  ]);

  // 초기화
  const resetModal = () => {
    setCurrentStep(0);
    setSelectedCategory(null);
    setSelectedPreset(null);
    setSelectedChannel(null);
    setChannelList([]);
    setLoadingChannels(false);
    setChannelError(null);
    setChannelRetryCount(0);
    setDatePresetKey('last7days');
    setCustomDateRange([dayjs().subtract(6, 'days'), dayjs()]);
    setCompareEnabled(true);
    setCompareRanges([{ id: 1, type: 'auto', monthsAgo: 1, customRange: null }]);
  };

  // Step 2에서 지표 선택 시 비교 기능 자동 설정
  useEffect(() => {
    if (selectedPreset) {
      // table/text 타입이면 비교 기능 자동 OFF
      if (TYPES_WITHOUT_COMPARE.includes(selectedPreset.type)) {
        setCompareEnabled(false);
      } else {
        // 다른 타입은 기본값 true (사용자가 선택 가능)
        setCompareEnabled(true);
      }
    }
  }, [selectedPreset]);

  // 채널 목록 불러오기 (Step 3 진입 시)
  useEffect(() => {
    if (currentStep === 2 && isChannelFunnelWidget() && channelList.length === 0 && !loadingChannels) {
      fetchChannelList();
    }
  }, [currentStep, selectedPreset]);

  // 채널 목록 API 호출
  const fetchChannelList = async () => {
    const FALLBACK_CHANNELS = ['Google', 'Naver', 'Meta', '직접 유입', 'Social', 'KakaoTalk', 'Instagram', '기타'];
    
    setLoadingChannels(true);
    setChannelError(null);
    
    try {
      const response = await axios.get('/api/stats/channel-funnel/channels');
      const channels = response.data?.channels || [];
      
      if (channels.length === 0) {
        setChannelError('no_data');
      } else {
        setChannelList(channels);
      }
    } catch (error) {
      console.error('Failed to fetch channel list:', error);
      setChannelError('api_error');
      
      // 3번 재시도 후 Fallback 목록 사용
      if (channelRetryCount >= 2) {
        setChannelList(FALLBACK_CHANNELS);
        setChannelError('using_fallback');
      }
    } finally {
      setLoadingChannels(false);
    }
  };

  // 재시도 핸들러
  const handleRetryChannels = () => {
    setChannelRetryCount(channelRetryCount + 1);
    fetchChannelList();
  };

  // 모달 닫기
  const handleClose = () => {
    resetModal();
    onClose();
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

  // 채널별 전환 퍼널 위젯인지 확인
  const isChannelFunnelWidget = () => {
    return selectedPreset?.id === 'channel_funnel_chart';
  };

  // 완료 처리
  const handleComplete = () => {
    if (!selectedPreset) return;
    
    const [startDate, endDate] = getCurrentDateRange();
    const compareRangesForSave = getCompareRangesForSave();
    
    // 비교 기능을 지원하지 않는 타입이면 강제로 false/빈 배열
    const finalCompareEnabled = TYPES_WITHOUT_COMPARE.includes(selectedPreset.type) 
      ? false 
      : compareEnabled;
    
    const finalCompareRanges = TYPES_WITHOUT_COMPARE.includes(selectedPreset.type)
      ? []
      : compareRangesForSave;
    
    const widgetData = {
      id: `widget-${Date.now()}`,
      type: selectedPreset.type,
      title: isChannelFunnelWidget() ? `${selectedPreset.label} - ${selectedChannel}` : selectedPreset.label,
      widthSize: selectedPreset.defaultWidth,
      heightSize: selectedPreset.defaultHeight,
      // 위젯 설정 정보
      presetId: selectedPreset.id,
      category: selectedCategory,
      apiEndpoint: selectedPreset.apiEndpoint,
      dataKey: selectedPreset.dataKey,
      suffix: selectedPreset.suffix || '',
      // 기간 설정
      dateRange: {
        start: startDate.format('YYYY-MM-DD'),
        end: endDate.format('YYYY-MM-DD'),
        presetKey: datePresetKey
      },
      compareEnabled: finalCompareEnabled,
      compareRanges: finalCompareRanges,
      // 초기 데이터 (로딩 상태)
      data: null,
      loading: true
    };
    
    // 채널별 전환 퍼널 위젯일 경우 selectedChannel 추가
    if (isChannelFunnelWidget()) {
      widgetData.selectedChannel = selectedChannel;
    }
    
    onAdd(widgetData);
    
    handleClose();
  };

  // 총 단계 수 계산
  const getTotalSteps = () => {
    if (isChannelFunnelWidget()) {
      return 3; // 카테고리 > 지표 > 보기 모드 > 기간 (4단계지만 인덱스는 0-3)
    }
    return 2; // 카테고리 > 지표 > 기간 (3단계지만 인덱스는 0-2)
  };

  // 다음 단계로
  const handleNext = () => {
    const maxStep = getTotalSteps();
    if (currentStep < maxStep) {
      setCurrentStep(currentStep + 1);
    }
  };

  // 이전 단계로
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 다음 버튼 활성화 여부
  const canGoNext = () => {
    if (currentStep === 0) return selectedCategory !== null;
    if (currentStep === 1) return selectedPreset !== null;
    if (currentStep === 2 && isChannelFunnelWidget()) return selectedChannel !== null; // 채널 선택 필수
    return true;
  };

  // Step 1: 카테고리 선택 렌더링
  const renderStep1 = () => (
    <div>
      <Text style={{ display: 'block', marginBottom: 16, fontSize: 15 }}>
        무엇을 보고 싶으세요?
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Object.values(DATA_SOURCES).map(source => (
          <div
            key={source.id}
            onClick={() => source.enabled && setSelectedCategory(source.id)}
            style={{
              padding: 20,
              border: selectedCategory === source.id ? '2px solid #1890ff' : '1px solid #e8e8e8',
              borderRadius: 12,
              cursor: source.enabled ? 'pointer' : 'not-allowed',
              background: selectedCategory === source.id ? '#e6f7ff' : source.enabled ? 'white' : '#fafafa',
              opacity: source.enabled ? 1 : 0.6,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 16
            }}
          >
            <div style={{ 
              width: 56, 
              height: 56, 
              borderRadius: 12, 
              background: source.enabled ? '#f0f5ff' : '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {source.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontWeight: 600, 
                fontSize: 16, 
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                {source.name}
                {source.comingSoon && (
                  <span style={{ 
                    fontSize: 11, 
                    background: '#f0f0f0', 
                    padding: '2px 8px', 
                    borderRadius: 4,
                    color: '#8c8c8c',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <Lock size={10} /> 준비중
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#595959' }}>{source.description}</div>
            </div>
            {source.enabled && (
              <div style={{ 
                width: 24, 
                height: 24, 
                borderRadius: '50%',
                border: selectedCategory === source.id ? 'none' : '2px solid #d9d9d9',
                background: selectedCategory === source.id ? '#1890ff' : 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {selectedCategory === source.id && <Check size={12} color="white" />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Step 2: 지표 선택 렌더링
  const renderStep2 = () => {
    const presets = WIDGET_PRESETS[selectedCategory];
    if (!presets) return <div>해당 카테고리의 위젯이 없습니다.</div>;

    const sections = [
      { key: 'kpi', label: '숫자 카드', sublabel: '한눈에 보기', items: presets.kpi || [] },
      { key: 'chart', label: '그래프', sublabel: '추이 보기', items: presets.chart || [] },
      { key: 'list', label: '목록', sublabel: '상세 보기', items: presets.list || [] }
    ];

    return (
      <div>
        <Text style={{ display: 'block', marginBottom: 16, fontSize: 15 }}>
          어떤 정보를 볼까요?
        </Text>
        <div>
        {sections.map(section => (
          section.items.length > 0 && (
            <div key={section.key} style={{ marginBottom: 20 }}>
              <div style={{ 
                fontSize: 13, 
                color: '#8c8c8c', 
                marginBottom: 10,
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: 8
              }}>
                {section.label} ({section.sublabel})
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: 10 
              }}>
                {section.items.map(item => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedPreset(item)}
                    style={{
                      padding: 14,
                      border: selectedPreset?.id === item.id ? '2px solid #1890ff' : '1px solid #e8e8e8',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: selectedPreset?.id === item.id ? '#e6f7ff' : 'white',
                      transition: 'all 0.2s ease',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 6, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>{item.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#595959', lineHeight: 1.3 }}>{item.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
        </div>
      </div>
    );
  };

  // Step 3: 채널 선택 렌더링 (채널별 전환 퍼널만)
  const renderChannelSelectionStep = () => {
    // 로딩 중
    if (loadingChannels) {
      return (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: 300
        }}>
          <Spin indicator={<Loader2 size={32} className="animate-spin" />} />
          <Text style={{ marginTop: 16, color: '#8c8c8c' }}>
            데이터가 있는 채널 목록을 불러오는 중...
          </Text>
        </div>
      );
    }

    // API 에러
    if (channelError === 'api_error' && channelRetryCount < 3) {
      return (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: 300
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <Text style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            채널 목록을 불러올 수 없습니다
          </Text>
          <Text style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 24 }}>
            네트워크 연결을 확인해주세요
          </Text>
          <Button 
            type="primary" 
            icon={<RotateCw size={16} />}
            onClick={handleRetryChannels}
          >
            다시 시도
          </Button>
        </div>
      );
    }

    // 데이터 없음
    if (channelError === 'no_data') {
      return (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: 300,
          padding: '0 40px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
          <Text style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            아직 트래킹된 채널이 없습니다
          </Text>
          <Text style={{ fontSize: 13, color: '#8c8c8c', lineHeight: 1.6 }}>
            방문자 추적 스크립트를 설치하시면 데이터가 수집됩니다
          </Text>
        </div>
      );
    }

    // Fallback 목록 사용 중 안내
    const usingFallback = channelError === 'using_fallback';

    // 정상: 채널 목록 표시
    return (
      <div>
        <Text style={{ display: 'block', marginBottom: 16, fontSize: 15 }}>
          어떤 채널을 볼까요?
        </Text>
        
        {usingFallback && (
          <div style={{ 
            marginBottom: 16, 
            padding: 12, 
            background: '#fffbe6', 
            borderRadius: 8,
            fontSize: 12,
            color: '#ad8b00'
          }}>
            ⚠️ 채널 목록 조회 실패로 기본 목록을 표시합니다
          </div>
        )}

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: 12,
          maxHeight: 360,
          overflowY: 'auto',
          paddingRight: 8
        }}>
          {channelList.map(channel => (
            <div
              key={channel}
              onClick={() => setSelectedChannel(channel)}
              style={{
                padding: 16,
                border: selectedChannel === channel ? '2px solid #1890ff' : '1px solid #e8e8e8',
                borderRadius: 10,
                cursor: 'pointer',
                background: selectedChannel === channel ? '#e6f7ff' : 'white',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ 
                fontWeight: selectedChannel === channel ? 600 : 500,
                fontSize: 14,
                color: selectedChannel === channel ? '#1890ff' : '#262626'
              }}>
                {channel}
              </span>
              {selectedChannel === channel && (
                <Check size={16} color="#1890ff" />
              )}
            </div>
          ))}
        </div>

        {/* 도움말 */}
        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          background: '#e6f7ff', 
          borderRadius: 8,
          fontSize: 13,
          color: '#096dd9'
        }}>
          💡 Tip: 선택한 채널의 전환 퍼널을 분석합니다. 여러 채널을 비교하려면 위젯을 여러 개 추가하세요
        </div>
      </div>
    );
  };

  // 기간 설정 렌더링
  const renderDateRangeStep = () => {
    const [currentStart, currentEnd] = getCurrentDateRange();
    
    // 선택된 지표가 비교 기능을 지원하는지 확인
    const shouldShowCompare = selectedPreset && 
      !TYPES_WITHOUT_COMPARE.includes(selectedPreset.type);

    return (
      <div>
        <Text style={{ display: 'block', marginBottom: 16, fontSize: 15 }}>
          언제 데이터를 볼까요?
        </Text>
        
        {/* 기간 선택 */}
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

        {/* 비교 기간 - 지원하는 타입에만 표시 */}
        {shouldShowCompare && (
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
              {/* 자동 계산된 날짜 표시 (모든 지표 공통) */}
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
                {/* 기간별 매출 비교일 때: 첫 번째는 일반 UI + 추가 기간들 */}
                {selectedPreset?.id === 'period_revenue_compare' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* 첫 번째 비교 기간: 일반 UI 스타일 */}
                    {compareRanges.length > 0 && (() => {
                      const firstRange = compareRanges[0];
                      return (
                        <div key={firstRange.id} style={{ marginLeft: 24 }}>
                          {/* 라디오 그룹 */}
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
                          
                          {/* 직접 선택 시 날짜 선택기 */}
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
                      const actualIndex = index + 1; // 실제 인덱스 (0-based에서 1을 더함)
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
                          {/* 비교 기간 헤더 */}
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
                            {/* 삭제 버튼 */}
                            <Button 
                              type="text" 
                              size="small"
                              icon={<Trash2 size={16} />}
                              onClick={() => handleRemoveCompareRange(range.id)}
                              style={{ color: '#ff4d4f' }}
                            />
                          </div>
                          
                          {/* 비교 기간 타입 선택 */}
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
                          
                          {/* 직접 선택 시 날짜 선택기 */}
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
                    
                    {/* 비교할 기간 추가 버튼 (점선) */}
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
                  /* 그 외 지표: 단일 비교 기간 UI (이전 스타일) */
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
        )}

        {/* 도움말 - 타입에 따라 다른 메시지 */}
        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          background: '#fffbe6', 
          borderRadius: 8,
          fontSize: 13,
          color: '#ad8b00'
        }}>
          {selectedPreset?.id === 'period_revenue_compare' ? (
            <>💡 Tip: 여러 기간을 추가하면 월별 추이를 한눈에 비교할 수 있어요</>
          ) : shouldShowCompare ? (
            <>💡 Tip: 비교 기간을 설정하면 증감률(%)을 함께 볼 수 있어요</>
          ) : (
            <>💡 Tip: 선택한 기간의 상세 목록을 볼 수 있어요</>
          )}
        </div>
      </div>
    );
  };

  // 동적 steps 배열 생성
  const getSteps = () => {
    if (isChannelFunnelWidget()) {
      return [
        { title: '카테고리', description: '무엇을 볼까요?' },
        { title: '지표', description: '어떤 정보?' },
        { title: '채널', description: '어떤 채널?' },
        { title: '기간', description: '언제 데이터?' }
      ];
    }
    return [
      { title: '카테고리', description: '무엇을 볼까요?' },
      { title: '지표', description: '어떤 정보?' },
      { title: '기간', description: '언제 데이터?' }
    ];
  };

  const steps = getSteps();

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={20} color="#1890ff" />
          <span>위젯 추가</span>
        </div>
      }
      open={visible}
      onCancel={handleClose}
      width={640}
      style={{ top: 20 }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button 
            onClick={handlePrev} 
            disabled={currentStep === 0}
            icon={<ChevronLeft size={16} />}
          >
            이전
          </Button>
          <div>
            <Button onClick={handleClose} style={{ marginRight: 8 }}>
              취소
            </Button>
            {currentStep < getTotalSteps() ? (
              <Button 
                type="primary" 
                onClick={handleNext}
                disabled={!canGoNext()}
              >
                다음 <ChevronRight size={16} />
              </Button>
            ) : (
              <Button 
                type="primary" 
                onClick={handleComplete}
                disabled={!selectedPreset}
                icon={<Check size={16} />}
              >
                완료
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* 스텝 인디케이터 - Step 1(카테고리)에서는 숨김 */}
      {currentStep > 0 && (
        <Steps 
          current={currentStep} 
          size="small" 
          style={{ marginBottom: 24 }}
          items={steps.map(step => ({ title: step.title }))}
        />
      )}
      
      {/* 스텝별 콘텐츠 */}
      <div style={{ minHeight: currentStep === 1 ? 520 : 320 }}>
        {currentStep === 0 && renderStep1()}
        {currentStep === 1 && renderStep2()}
        {currentStep === 2 && (isChannelFunnelWidget() ? renderChannelSelectionStep() : renderDateRangeStep())}
        {currentStep === 3 && isChannelFunnelWidget() && renderDateRangeStep()}
      </div>
    </Modal>
  );
};

export default AddWidgetModal;
