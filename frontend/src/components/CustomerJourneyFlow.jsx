/**
 * 고객 여정 플로우차트 컴포넌트
 * React Flow를 사용한 페이지 이동 경로 시각화
 */

import React, { useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { convertPagePathToFlow, calculateFlowStats } from '../utils/pagePathToFlow.jsx';

/**
 * CustomerJourneyFlow 컴포넌트
 * @param {Array} pagePath - 페이지 경로 데이터
 * @param {boolean} useKoreanNames - 한글 이름 사용 여부
 */
export default function CustomerJourneyFlow({ pagePath, useKoreanNames = true, mappings = {} }) {
  // 페이지 경로를 노드와 엣지로 변환
  const { nodes: initialNodes, edges: initialEdges } = convertPagePathToFlow(
    pagePath,
    useKoreanNames,
    mappings
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 통계 계산
  const stats = calculateFlowStats(pagePath);

  if (!pagePath || pagePath.length === 0) {
    return (
      <div style={{
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
        borderRadius: '8px',
        border: '1px dashed #d1d5db'
      }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <div style={{ fontSize: '16px', fontWeight: '600' }}>페이지 이동 경로가 없습니다</div>
          <div style={{ fontSize: '14px', marginTop: '8px' }}>고객의 페이지 방문 기록이 표시됩니다</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 플로우차트 통계 */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '16px',
        padding: '16px',
        background: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
            {stats.totalPages}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            방문 페이지 수
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid #e5e7eb', paddingLeft: '16px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
            {stats.totalTime >= 60
              ? `${Math.floor(stats.totalTime / 60)}분 ${stats.totalTime % 60}초`
              : `${stats.totalTime}초`
            }
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            총 여정 시간
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid #e5e7eb', paddingLeft: '16px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
            {stats.averageTime >= 60
              ? `${Math.floor(stats.averageTime / 60)}분 ${stats.averageTime % 60}초`
              : `${stats.averageTime}초`
            }
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            평균 체류 시간
          </div>
        </div>
      </div>

      {/* React Flow 차트 */}
      <div style={{
        height: '500px',
        background: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden'
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          attributionPosition="bottom-left"
          minZoom={0.5}
          maxZoom={1.5}
          defaultViewport={{ x: 50, y: 100, zoom: 0.8 }}
        >
          <Background color="#f1f5f9" gap={16} />
          <Controls
            style={{
              button: {
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderBottom: 'none'
              }
            }}
          />
          <MiniMap
            nodeColor={(node) => {
              // 노드 색상을 스타일에서 가져옴
              return node.style?.background || '#f3f4f6';
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb'
            }}
          />
        </ReactFlow>
      </div>

      {/* 사용 안내 */}
      <div style={{
        marginTop: '12px',
        padding: '12px',
        background: '#f9fafb',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#6b7280'
      }}>
        💡 <strong>사용 팁:</strong> 마우스 휠로 확대/축소, 드래그로 이동, 하단 컨트롤러로 조작 가능합니다.
      </div>
    </div>
  );
}

