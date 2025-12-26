import { useState, useRef, useEffect } from 'react';
import { PlayCircleOutlined, PictureOutlined, LoadingOutlined, CloseOutlined } from '@ant-design/icons';
import { Spin } from 'antd';
import '../styles/thumbnail.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * 광고 썸네일 미리보기 컴포넌트
 * 메타 광고 관리자처럼 마우스 오버 시 확대 미리보기 표시
 * - 팝업으로 마우스 이동해도 유지
 * - 동영상 재생 지원
 * - 고해상도 이미지 표시
 * - 영상 소스 없을 시 Meta Ad Preview iframe 사용
 */
function AdThumbnailPreview({ thumbnailUrl, isVideo, name, adId }) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ top: 0, left: 0 });
  const [mediaDetails, setMediaDetails] = useState(null);
  const [previewIframe, setPreviewIframe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [videoError, setVideoError] = useState(false);
  
  const containerRef = useRef(null);
  const popupRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const hideTimeoutRef = useRef(null);

  // 미디어 상세 정보 및 Ad Preview 병렬 로드
  const loadMediaDetails = async () => {
    if (mediaDetails || loading) return;
    
    setLoading(true);
    try {
      // 영상인 경우 미디어 정보와 Ad Preview를 병렬로 로드
      const mediaPromise = fetch(`${API_BASE}/api/meta/ad/${adId}/media`).then(r => r.json());
      const previewPromise = isVideo 
        ? fetch(`${API_BASE}/api/meta/ad/${adId}/preview?format=MOBILE_FEED_STANDARD`).then(r => r.json())
        : Promise.resolve(null);
      
      const [mediaResult, previewResult] = await Promise.all([mediaPromise, previewPromise]);
      
      if (mediaResult.success) {
        setMediaDetails(mediaResult.data);
      }
      
      // Ad Preview iframe 설정 (videoSource가 없는 영상용)
      if (previewResult?.success && previewResult.data?.iframeSrc) {
        setPreviewIframe(previewResult.data.iframeSrc);
      }
    } catch (error) {
      console.error('Failed to load media details:', error);
    } finally {
      setLoading(false);
    }
  };

  // 미리보기 위치 계산
  const calculatePosition = () => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const popupWidth = 360;
    const popupHeight = 450;
    
    let top = rect.top - 20;
    let left = rect.right + 15;
    
    // 오른쪽 공간 부족 시 왼쪽에 표시
    if (left + popupWidth > viewportWidth - 20) {
      left = rect.left - popupWidth - 15;
    }
    
    // 아래 공간 부족 시 위로 조정
    if (top + popupHeight > viewportHeight - 20) {
      top = viewportHeight - popupHeight - 20;
    }
    
    // 위쪽 공간 부족 시 아래로 조정
    if (top < 20) {
      top = 20;
    }
    
    setPreviewPosition({ top, left });
  };

  // 마우스 진입 (썸네일 또는 팝업)
  const handleMouseEnter = () => {
    // 숨기기 타이머 취소
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    
    // 이미 표시 중이면 유지
    if (showPreview) return;
    
    // 딜레이 후 미리보기 표시
    hoverTimeoutRef.current = setTimeout(() => {
      calculatePosition();
      setShowPreview(true);
      loadMediaDetails();
    }, 200);
  };

  // 마우스 이탈 (썸네일 또는 팝업)
  const handleMouseLeave = () => {
    // 표시 타이머 취소
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    // 약간의 딜레이 후 숨기기 (팝업으로 이동할 시간 확보)
    hideTimeoutRef.current = setTimeout(() => {
      setShowPreview(false);
      setVideoError(false);
    }, 150);
  };

  // 팝업 닫기
  const handleClosePreview = (e) => {
    e.stopPropagation();
    setShowPreview(false);
    setVideoError(false);
  };

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // 표시할 이미지 URL 결정
  const displayImageUrl = mediaDetails?.imageUrl || mediaDetails?.videoThumbnail || thumbnailUrl;
  const videoSourceUrl = mediaDetails?.videoSource;
  const adText = mediaDetails?.adText;

  // 썸네일이 없는 경우 플레이스홀더 표시
  if (!thumbnailUrl) {
    return (
      <div className="ad-thumbnail-placeholder">
        {isVideo ? (
          <PlayCircleOutlined style={{ fontSize: '16px', color: '#bfbfbf' }} />
        ) : (
          <PictureOutlined style={{ fontSize: '16px', color: '#bfbfbf' }} />
        )}
      </div>
    );
  }

  // 영상 재생 가능 여부 (videoSource가 있거나 iframe이 있으면 재생 가능)
  const canPlayVideo = videoSourceUrl || previewIframe;
  const showIframePreview = mediaDetails?.isVideo && !videoSourceUrl && previewIframe;

  return (
    <>
      {/* 썸네일 */}
      <div
        ref={containerRef}
        className="ad-thumbnail-container"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <img
          src={thumbnailUrl}
          alt={name}
          className="ad-thumbnail-image"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        <div className="ad-thumbnail-fallback" style={{ display: 'none' }}>
          {isVideo ? (
            <PlayCircleOutlined style={{ fontSize: '16px', color: '#bfbfbf' }} />
          ) : (
            <PictureOutlined style={{ fontSize: '16px', color: '#bfbfbf' }} />
          )}
        </div>
        {isVideo && (
          <div className="ad-thumbnail-video-badge">
            <PlayCircleOutlined style={{ fontSize: '10px' }} />
          </div>
        )}
      </div>

      {/* 확대 미리보기 팝업 */}
      {showPreview && (
        <div
          ref={popupRef}
          className="ad-preview-popup"
          style={{
            top: previewPosition.top,
            left: previewPosition.left
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* 헤더 */}
          <div className="ad-preview-header">
            <div className="ad-preview-header-content">
              <span className="ad-preview-title" title={name}>{name}</span>
              <span className="ad-preview-id">ID: {adId}</span>
            </div>
            <button className="ad-preview-close" onClick={handleClosePreview}>
              <CloseOutlined />
            </button>
          </div>

          {/* 콘텐츠 */}
          <div className="ad-preview-content">
            {loading ? (
              <div className="ad-preview-loading">
                <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
                <span>미디어 로딩 중...</span>
              </div>
            ) : showIframePreview ? (
              /* Meta Ad Preview iframe */
              <iframe
                src={previewIframe}
                className="ad-preview-iframe"
                title={`Ad Preview - ${name}`}
                scrolling="yes"
              />
            ) : (mediaDetails?.isVideo || isVideo) && videoSourceUrl && !videoError ? (
              /* 동영상 플레이어 */
              <video
                className="ad-preview-video"
                src={videoSourceUrl}
                poster={displayImageUrl}
                controls
                autoPlay
                muted
                loop
                onError={() => setVideoError(true)}
              />
            ) : (mediaDetails?.isVideo || isVideo) && !videoSourceUrl && !previewIframe ? (
              /* 영상인데 videoSource도 없고 iframe도 아직 없는 경우 - 로딩 표시 */
              <div className="ad-preview-loading">
                <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
                <span>미리보기 로딩 중...</span>
              </div>
            ) : (
              /* 이미지 */
              <img
                src={displayImageUrl || thumbnailUrl}
                alt={name}
                className="ad-preview-image"
                onError={(e) => {
                  if (e.target.src !== thumbnailUrl) {
                    e.target.src = thumbnailUrl;
                  }
                }}
              />
            )}
            
            {/* 동영상인데 재생 불가능한 경우 오버레이 */}
            {(mediaDetails?.isVideo || isVideo) && !canPlayVideo && !loading && (
              <div className="ad-preview-video-overlay">
                <PlayCircleOutlined style={{ fontSize: '48px', color: 'white' }} />
                <span style={{ color: 'white', marginTop: '8px', fontSize: '12px' }}>
                  {videoError ? '동영상을 재생할 수 없습니다' : '동영상 미리보기'}
                </span>
              </div>
            )}
          </div>

          {/* 광고 텍스트 */}
          {adText && !showIframePreview && (
            <div className="ad-preview-text">
              {adText}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default AdThumbnailPreview;
