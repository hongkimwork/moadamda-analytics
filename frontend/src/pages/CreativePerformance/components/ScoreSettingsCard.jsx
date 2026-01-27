// ============================================================================
// 모수 평가 기준 설정 카드/버튼
// ============================================================================

import React from 'react';
import { Settings, BarChart2, TrendingUp, ChevronRight } from 'lucide-react';

/**
 * 모수 평가 기준 설정 버튼/카드
 * - 미설정: 버튼 표시
 * - 설정됨: 요약 카드 표시
 */
function ScoreSettingsCard({ settings, onClick }) {
  // 미설정 상태: 버튼
  if (!settings) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-4 h-[42px] w-full text-gray-500 bg-white border border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all duration-200 group"
      >
        <div className="bg-gray-100 p-1.5 rounded-md group-hover:bg-blue-100 transition-colors">
          <Settings size={16} className="text-gray-400 group-hover:text-blue-500" />
        </div>
        <span className="text-sm font-medium">모수 평가 기준 설정하기</span>
      </button>
    );
  }

  // 설정됨 상태: 요약 카드
  const isRelative = settings.evaluation_type === 'relative';

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col gap-2 p-4 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all duration-200"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${isRelative ? 'bg-blue-100' : 'bg-green-100'}`}>
            {isRelative ? (
              <BarChart2 size={16} className="text-blue-600" />
            ) : (
              <TrendingUp size={16} className="text-green-600" />
            )}
          </div>
          <span className="text-sm font-bold text-gray-800">
            {isRelative ? '상대평가' : '절대평가'}
          </span>
        </div>
        <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
      </div>
      
      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
        <span className="font-medium">중요도:</span>
        <div className="flex gap-2">
          <span>스크롤 <b className="text-gray-700">{settings.weight_scroll}%</b></span>
          <span className="text-gray-300">|</span>
          <span>PV <b className="text-gray-700">{settings.weight_pv}%</b></span>
          <span className="text-gray-300">|</span>
          <span>체류 <b className="text-gray-700">{settings.weight_duration}%</b></span>
        </div>
      </div>
    </div>
  );
}

export default ScoreSettingsCard;
