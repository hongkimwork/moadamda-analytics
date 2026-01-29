// ============================================================================
// 광고 소재 미디어 프리뷰 모달
// Meta 광고의 이미지/동영상을 모달로 표시
// ============================================================================

import { useState, useEffect } from 'react';
import { Modal, Spin, Result, Button } from 'antd';
import { PlayCircleOutlined, PictureOutlined, LoadingOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * 광고 소재 미디어 프리뷰 모달
 * @param {Object} props
 * @param {boolean} props.visible - 모달 표시 여부
 * @param {Function} props.onClose - 모달 닫기 핸들러
 * @param {string} props.creativeName - 광고 소재 이름
 */
function CreativeMediaPreviewModal({ visible, onClose, creativeName }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [adData, setAdData] = useState(null);
  const [previewIframe, setPreviewIframe] = useState(null);
  const [videoError, setVideoError] = useState(false);

  // 광고 미디어 정보 로드
  useEffect(() => {
    if (visible && creativeName) {
      loadAdMedia();
    }
    
    // 모달 닫힐 때 상태 초기화
    if (!visible) {
      setAdData(null);
      setError(null);
      setPreviewIframe(null);
      setVideoError(false);
    }
  }, [visible, creativeName]);

  const loadAdMedia = async () => {
    setLoading(true);
    setError(null);
    setAdData(null);
    setPreviewIframe(null);
    
    try {
      // 1. 광고 이름으로 매칭 및 미디어 정보 조회
      const response = await axios.get(`${API_BASE}/api/meta/ad-by-name`, {
        params: { name: creativeName }
      });
      
      if (!response.data.success || !response.data.matched) {
        setError('matching_failed');
        return;
      }
      
      setAdData(response.data.data);
      
      // 2. 동영상인 경우 또는 미디어가 없는 경우 iframe 프리뷰 로드
      const needsIframe = response.data.data.isVideo || 
        (!response.data.data.thumbnailUrl && !response.data.data.media?.imageUrl && !response.data.data.media?.videoSource);
      
      if (needsIframe && response.data.data.adId) {
        try {
          const previewResponse = await axios.get(
            `${API_BASE}/api/meta/ad/${response.data.data.adId}/preview`,
            { params: { format: 'MOBILE_FEED_STANDARD' } }
          );
          
          if (previewResponse.data.success && previewResponse.data.data?.iframeSrc) {
            setPreviewIframe(previewResponse.data.data.iframeSrc);
          }
        } catch (previewError) {
          console.error('Preview iframe load failed:', previewError);
          // iframe 로드 실패해도 이미지는 표시
        }
      }
    } catch (err) {
      console.error('Failed to load ad media:', err);
      setError('api_error');
    } finally {
      setLoading(false);
    }
  };

  // 미디어 URL 결정
  const getMediaUrl = () => {
    if (!adData) return null;
    
    // media 객체에서 고해상도 이미지/동영상 URL 가져오기
    if (adData.media) {
      if (adData.isVideo && adData.media.videoSource) {
        return { type: 'video', url: adData.media.videoSource, poster: adData.media.videoThumbnail || adData.thumbnailUrl };
      }
      if (adData.media.imageUrl) {
        return { type: 'image', url: adData.media.imageUrl };
      }
    }
    
    // 기본 썸네일
    if (adData.thumbnailUrl) {
      return { type: 'image', url: adData.thumbnailUrl };
    }
    
    return null;
  };

  const mediaInfo = getMediaUrl();
  // 미디어 URL이 없고 iframe이 있으면 iframe 표시 (비디오가 아니어도)
  const showIframePreview = !mediaInfo?.url && previewIframe;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {adData?.isVideo ? (
            <PlayCircleOutlined style={{ color: '#1890ff' }} />
          ) : (
            <PictureOutlined style={{ color: '#1890ff' }} />
          )}
          <span>광고 소재 미리보기</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={480}
      style={{ top: 10 }}
      styles={{ body: { minHeight: '700px' } }}
      destroyOnClose
    >
      {/* 로딩 상태 */}
      {loading && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '60px 20px',
          gap: '16px'
        }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} />
          <span style={{ color: '#666' }}>미디어 로딩 중...</span>
        </div>
      )}

      {/* 에러 상태 */}
      {!loading && error && (
        <Result
          icon={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
          title="미디어를 찾을 수 없습니다"
          subTitle={
            error === 'matching_failed' 
              ? '이 광고 소재와 일치하는 Meta 광고를 찾지 못했습니다.'
              : '미디어 정보를 불러오는 중 오류가 발생했습니다.'
          }
          extra={
            <Button onClick={loadAdMedia}>다시 시도</Button>
          }
        />
      )}

      {/* 미디어 표시 */}
      {!loading && !error && adData && (
        <div>
          {/* 광고 이름 */}
          <div style={{ 
            marginBottom: '16px', 
            padding: '12px', 
            backgroundColor: '#fafafa', 
            borderRadius: '8px' 
          }}>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>광고명</div>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: 600, 
              wordBreak: 'break-all',
              lineHeight: 1.5
            }}>
              {adData.name}
            </div>
            {adData.originalName !== adData.name && (
              <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                (원본: {adData.originalName})
              </div>
            )}
          </div>

          {/* 미디어 콘텐츠 */}
          <div style={{ 
            backgroundColor: '#000', 
            borderRadius: '8px', 
            overflow: 'hidden',
            minHeight: '700px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {showIframePreview ? (
              /* Meta Ad Preview iframe */
              <iframe
                src={previewIframe}
                style={{
                  width: '100%',
                  height: '700px',
                  border: 'none',
                  backgroundColor: '#fff'
                }}
                title={`Ad Preview - ${adData.name}`}
                scrolling="yes"
              />
            ) : mediaInfo?.type === 'video' && !videoError ? (
              /* 동영상 플레이어 */
              <video
                src={mediaInfo.url}
                poster={mediaInfo.poster}
                controls
                autoPlay
                muted
                loop
                style={{
                  width: '100%',
                  maxHeight: '700px',
                  objectFit: 'contain'
                }}
                onError={() => setVideoError(true)}
              />
            ) : mediaInfo?.url ? (
              /* 이미지 */
              <img
                src={mediaInfo.url}
                alt={adData.name}
                style={{
                  width: '100%',
                  maxHeight: '700px',
                  objectFit: 'contain'
                }}
                onError={(e) => {
                  // 고해상도 이미지 실패 시 썸네일로 폴백
                  if (adData.thumbnailUrl && e.target.src !== adData.thumbnailUrl) {
                    e.target.src = adData.thumbnailUrl;
                  }
                }}
              />
            ) : (
              /* 미디어 없음 */
              <div style={{ 
                padding: '60px 20px', 
                color: '#999', 
                textAlign: 'center' 
              }}>
                {adData.isVideo ? (
                  <>
                    <PlayCircleOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                    <div>동영상을 표시할 수 없습니다</div>
                  </>
                ) : (
                  <>
                    <PictureOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                    <div>이미지를 표시할 수 없습니다</div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 광고 텍스트 (있는 경우) */}
          {adData.media?.adText && !showIframePreview && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#fafafa',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#595959',
              lineHeight: 1.6,
              maxHeight: '100px',
              overflow: 'auto',
              wordBreak: 'break-word'
            }}>
              {adData.media.adText}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default CreativeMediaPreviewModal;
