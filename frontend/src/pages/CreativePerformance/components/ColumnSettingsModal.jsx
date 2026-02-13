import React, { useState, useMemo, useEffect } from 'react';
import { Modal, Checkbox, Button, Input, Typography, Tooltip } from 'antd';
import {
  SearchOutlined,
  InfoCircleOutlined,
  CloseOutlined,
  HolderOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  ALL_COLUMNS,
  COLUMN_CATEGORIES,
  DEFAULT_VISIBLE_COLUMNS,
  ALWAYS_VISIBLE_COLUMNS,
  FIXED_COLUMNS
} from '../utils/columnDefinitions';

const { Text, Title } = Typography;

/**
 * 광고 소재 퍼포먼스 컬럼 설정 모달
 * 메타 성과 조회 페이지의 ColumnSettingsModal과 동일한 UX
 */
function ColumnSettingsModal({
  open,
  onClose,
  visibleColumns,
  columnOrder,
  onApply,
  onReset
}) {
  const [tempSelected, setTempSelected] = useState([]);
  const [tempOrder, setTempOrder] = useState([]);
  const [searchText, setSearchText] = useState('');

  // 카테고리별 컬럼 그룹핑 (action 컬럼은 모달에서 제외)
  const editableColumns = useMemo(() =>
    ALL_COLUMNS.filter(col => col.key !== 'action'),
    []
  );

  const columnsByCategory = useMemo(() => {
    const grouped = {};
    Object.values(COLUMN_CATEGORIES).forEach(cat => {
      grouped[cat] = editableColumns.filter(col => col.category === cat);
    });
    return grouped;
  }, [editableColumns]);

  const filteredColumnsByCategory = useMemo(() => {
    if (!searchText) return columnsByCategory;

    const filtered = {};
    Object.entries(columnsByCategory).forEach(([cat, cols]) => {
      const matchedCols = cols.filter(col =>
        col.title.toLowerCase().includes(searchText.toLowerCase()) ||
        col.tooltip?.toLowerCase().includes(searchText.toLowerCase())
      );
      if (matchedCols.length > 0) {
        filtered[cat] = matchedCols;
      }
    });
    return filtered;
  }, [columnsByCategory, searchText]);

  // 모달 열릴 때 현재 설정으로 초기화
  useEffect(() => {
    if (open) {
      setTempSelected([...visibleColumns]);
      setTempOrder(columnOrder || [...visibleColumns]);
      setSearchText('');
    }
  }, [open, visibleColumns, columnOrder]);

  const handleCheckChange = (columnKey, checked) => {
    // 항상 표시 컬럼은 해제 불가
    if (ALWAYS_VISIBLE_COLUMNS.includes(columnKey)) return;

    if (checked) {
      setTempSelected([...tempSelected, columnKey]);
      setTempOrder([...tempOrder, columnKey]);
    } else {
      setTempSelected(tempSelected.filter(k => k !== columnKey));
      setTempOrder(tempOrder.filter(k => k !== columnKey));
    }
  };

  const handleCategoryCheckAll = (category, checked) => {
    const categoryColumns = columnsByCategory[category];
    const categoryKeys = categoryColumns
      .map(c => c.key)
      .filter(k => !ALWAYS_VISIBLE_COLUMNS.includes(k));

    if (checked) {
      const newSelected = [...new Set([...tempSelected, ...categoryKeys])];
      const newOrder = [...new Set([...tempOrder, ...categoryKeys])];
      setTempSelected(newSelected);
      setTempOrder(newOrder);
    } else {
      setTempSelected(tempSelected.filter(k => !categoryKeys.includes(k) || ALWAYS_VISIBLE_COLUMNS.includes(k)));
      setTempOrder(tempOrder.filter(k => !categoryKeys.includes(k) || ALWAYS_VISIBLE_COLUMNS.includes(k)));
    }
  };

  const getCategoryCheckState = (category) => {
    const categoryColumns = columnsByCategory[category];
    const categoryKeys = categoryColumns
      .map(c => c.key)
      .filter(k => !ALWAYS_VISIBLE_COLUMNS.includes(k));
    if (categoryKeys.length === 0) return { checked: true, indeterminate: false };

    const checkedCount = categoryKeys.filter(k => tempSelected.includes(k)).length;

    if (checkedCount === 0) return { checked: false, indeterminate: false };
    if (checkedCount === categoryKeys.length) return { checked: true, indeterminate: false };
    return { checked: false, indeterminate: true };
  };

  const handleRemoveColumn = (columnKey) => {
    if (ALWAYS_VISIBLE_COLUMNS.includes(columnKey)) return;
    setTempSelected(tempSelected.filter(k => k !== columnKey));
    setTempOrder(tempOrder.filter(k => k !== columnKey));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    // 드래그 가능한 항목만 (fixed 제외)
    const draggableItems = tempOrder
      .filter(k => tempSelected.includes(k) && !FIXED_COLUMNS.includes(k));
    const [reorderedItem] = draggableItems.splice(result.source.index, 1);
    draggableItems.splice(result.destination.index, 0, reorderedItem);

    // fixed left → 드래그 항목 → fixed right 순서 재조립
    const fixedLeft = tempOrder.filter(k => tempSelected.includes(k) && ALL_COLUMNS.find(c => c.key === k)?.fixed === 'left');
    const fixedRight = tempOrder.filter(k => tempSelected.includes(k) && ALL_COLUMNS.find(c => c.key === k)?.fixed === 'right');
    const unselected = tempOrder.filter(k => !tempSelected.includes(k));

    setTempOrder([...fixedLeft, ...draggableItems, ...fixedRight, ...unselected]);
  };

  const handleApply = () => {
    // action 컬럼은 항상 포함
    const selectedWithAction = tempSelected.includes('action')
      ? tempSelected
      : [...tempSelected, 'action'];

    const orderedSelected = tempOrder.filter(k => selectedWithAction.includes(k));
    const remaining = selectedWithAction.filter(k => !tempOrder.includes(k));
    const finalOrder = [...orderedSelected, ...remaining];

    onApply(selectedWithAction, finalOrder);
    onClose();
  };

  const handleResetToDefault = () => {
    setTempSelected([...DEFAULT_VISIBLE_COLUMNS]);
    setTempOrder([...DEFAULT_VISIBLE_COLUMNS]);
  };

  const handleFullReset = () => {
    onReset();
    onClose();
  };

  const getColumnInfo = (key) => editableColumns.find(c => c.key === key);

  // 드래그 영역에 표시할 컬럼 (선택됨 + fixed 제외)
  const orderedDraggableColumns = useMemo(() => {
    return tempOrder.filter(k =>
      tempSelected.includes(k) && !FIXED_COLUMNS.includes(k)
    );
  }, [tempOrder, tempSelected]);

  // 선택된 전체 수 (action 제외)
  const selectedCount = tempSelected.filter(k => k !== 'action').length;

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      width={900}
      footer={null}
      closable={false}
      styles={{ body: { padding: 0 } }}
    >
      {/* 헤더 */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Title level={5} style={{ margin: 0 }}>컬럼 설정</Title>
        <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
      </div>

      {/* 설명 */}
      <div style={{ padding: '12px 24px', backgroundColor: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
        <Text type="secondary">표시할 컬럼을 선택하고 순서를 변경하세요. 설정은 자동으로 저장됩니다.</Text>
      </div>

      {/* 본문 - 2단 레이아웃 */}
      <div style={{ display: 'flex', height: '450px' }}>
        {/* 왼쪽: 컬럼 선택 */}
        <div style={{
          flex: 1,
          borderRight: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* 검색 */}
          <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            <Input
              placeholder="컬럼 검색"
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </div>

          {/* 카테고리별 컬럼 목록 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {Object.entries(filteredColumnsByCategory).map(([category, columns]) => {
              if (columns.length === 0) return null;

              const checkState = getCategoryCheckState(category);
              const catSelectedCount = columns.filter(c => tempSelected.includes(c.key)).length;

              return (
                <div key={category} style={{ marginBottom: '8px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 16px',
                    backgroundColor: '#fafafa',
                    borderTop: '1px solid #f0f0f0',
                    borderBottom: '1px solid #f0f0f0'
                  }}>
                    <Checkbox
                      checked={checkState.checked}
                      indeterminate={checkState.indeterminate}
                      onChange={(e) => handleCategoryCheckAll(category, e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    <Text strong style={{ flex: 1 }}>{category}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {catSelectedCount}/{columns.length}
                    </Text>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '4px 8px',
                    padding: '12px 16px 12px 40px'
                  }}>
                    {columns.map(col => (
                      <div key={col.key} style={{ display: 'flex', alignItems: 'center' }}>
                        <Checkbox
                          checked={tempSelected.includes(col.key)}
                          onChange={(e) => handleCheckChange(col.key, e.target.checked)}
                          disabled={ALWAYS_VISIBLE_COLUMNS.includes(col.key)}
                        >
                          <span style={{ fontSize: '13px' }}>{col.title}</span>
                        </Checkbox>
                        {col.tooltip && (
                          <Tooltip title={col.tooltip}>
                            <InfoCircleOutlined style={{
                              marginLeft: '4px',
                              fontSize: '11px',
                              color: '#bfbfbf',
                              cursor: 'help'
                            }} />
                          </Tooltip>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 오른쪽: 선택된 컬럼 순서 */}
        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            <Text strong>{selectedCount}개 컬럼 선택됨</Text>
            <div style={{ marginTop: '4px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                끌어다 놓아 컬럼 순서를 변경하세요.
              </Text>
            </div>
          </div>

          {/* 드래그 가능한 컬럼 목록 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="creative-columns">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    style={{ minHeight: '100%' }}
                  >
                    {orderedDraggableColumns.map((colKey, index) => {
                      const colInfo = getColumnInfo(colKey);
                      if (!colInfo) return null;
                      const isLocked = ALWAYS_VISIBLE_COLUMNS.includes(colKey);

                      return (
                        <Draggable
                          key={colKey}
                          draggableId={colKey}
                          index={index}
                          isDragDisabled={isLocked}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 12px',
                                marginBottom: '4px',
                                backgroundColor: snapshot.isDragging ? '#e6f4ff' : '#fff',
                                border: '1px solid #e8e8e8',
                                borderRadius: '6px',
                                cursor: isLocked ? 'not-allowed' : 'grab',
                                boxShadow: snapshot.isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                                userSelect: 'none'
                              }}
                            >
                              <HolderOutlined style={{
                                marginRight: '10px',
                                color: isLocked ? '#d9d9d9' : '#8c8c8c',
                                fontSize: '14px'
                              }} />
                              <Text style={{ flex: 1, fontSize: '13px' }}>
                                {colInfo.title}
                              </Text>
                              {!isLocked && (
                                <CloseOutlined
                                  style={{
                                    fontSize: '12px',
                                    color: '#bfbfbf',
                                    cursor: 'pointer',
                                    padding: '4px'
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveColumn(colKey);
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <div style={{
        padding: '12px 24px',
        borderTop: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Text type="secondary">{selectedCount}개 컬럼 선택됨</Text>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Button
            type="link"
            danger
            size="small"
            onClick={handleFullReset}
          >
            저장된 설정 초기화
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleResetToDefault}>
            기본값
          </Button>
          <Button onClick={onClose}>
            취소
          </Button>
          <Button type="primary" onClick={handleApply}>
            적용
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ColumnSettingsModal;
