# 📊 데이터베이스 구조 문서

> **작성일**: 2025-11-13  
> **목적**: 모아담다 애널리틱스 시스템의 데이터베이스 구조를 비개발자도 이해할 수 있도록 설명

---

## 📋 목차
1. [방문자 추적 테이블](#1-방문자-추적-테이블)
2. [세션 추적 테이블](#2-세션-추적-테이블)
3. [페이지뷰 추적 테이블](#3-페이지뷰-추적-테이블)
4. [이벤트 추적 테이블](#4-이벤트-추적-테이블)
5. [구매 전환 테이블](#5-구매-전환-테이블)
6. [실시간 방문자 테이블](#6-실시간-방문자-테이블)
7. [UTM 터치포인트 테이블](#7-utm-터치포인트-테이블)
8. [광고비 관리 테이블](#8-광고비-관리-테이블)
9. [Cafe24 토큰 관리 테이블](#9-cafe24-토큰-관리-테이블)
10. [URL 매핑 테이블](#10-url-매핑-테이블)

---

## 1. 방문자 추적 테이블
**테이블명**: `visitors`  
**용도**: 쇼핑몰에 방문한 사람들의 기본 정보를 저장

### 📌 필드 설명
| 필드명 | 설명 |
|--------|------|
| `visitor_id` | 방문자 고유 번호 (자동 생성된 식별번호) |
| `first_visit` | 최초 방문 시각 |
| `last_visit` | 가장 최근 방문 시각 |
| `visit_count` | 총 방문 횟수 |
| `device_type` | 접속 기기 종류 (모바일, PC 등) |
| `browser` | 사용한 브라우저 (Chrome, Safari 등) |
| `os` | 운영체제 (Windows, iOS, Android 등) |
| `referrer_type` | 유입 경로 유형 (검색엔진, SNS, 직접 방문 등) |
| `utm_source` | 광고 출처 (Facebook, Google, Instagram 등) |
| `utm_medium` | 광고 매체 (CPC, 배너, 이메일 등) |
| `utm_campaign` | 광고 캠페인명 (예: "겨울신상특가") |
| `utm_params` | 모든 UTM 파라미터를 JSON 형식으로 저장 |
| `ip_address` | 최초 방문 시 IP 주소 |
| `last_ip` | 가장 최근 방문 시 IP 주소 |
| `created_at` | 데이터 생성 시각 |

---

## 2. 세션 추적 테이블
**테이블명**: `sessions`  
**용도**: 방문자의 개별 방문(세션)마다 행동 패턴을 기록

### 📌 필드 설명
| 필드명 | 설명 |
|--------|------|
| `session_id` | 세션 고유 번호 |
| `visitor_id` | 어떤 방문자의 세션인지 (visitors 테이블 연결) |
| `start_time` | 세션 시작 시각 |
| `end_time` | 세션 종료 시각 |
| `pageview_count` | 이 세션에서 본 페이지 수 |
| `duration_seconds` | 체류 시간 (초 단위) |
| `entry_url` | 처음 들어온 페이지 URL |
| `exit_url` | 마지막으로 본 페이지 URL |
| `is_bounced` | 이탈 여부 (한 페이지만 보고 나갔는지) |
| `is_converted` | 구매 전환 여부 |
| `ip_address` | 이 세션의 IP 주소 |
| `utm_params` | 이 세션의 UTM 파라미터 (JSON) |
| `created_at` | 데이터 생성 시각 |

---

## 3. 페이지뷰 추적 테이블
**테이블명**: `pageviews`  
**용도**: 방문자가 본 모든 페이지를 하나하나 기록

### 📌 필드 설명
| 필드명 | 설명 |
|--------|------|
| `id` | 페이지뷰 고유 번호 (자동 증가) |
| `session_id` | 어떤 세션에서 본 페이지인지 |
| `visitor_id` | 어떤 방문자가 본 페이지인지 |
| `page_url` | 본 페이지의 URL |
| `page_title` | 페이지 제목 |
| `timestamp` | 페이지를 본 시각 |
| `time_spent` | 이 페이지에서 머문 시간 (초) |
| `created_at` | 데이터 생성 시각 |

---

## 4. 이벤트 추적 테이블
**테이블명**: `events`  
**용도**: 특정 행동(상품 클릭, 장바구니 담기 등)을 기록

### 📌 필드 설명
| 필드명 | 설명 |
|--------|------|
| `id` | 이벤트 고유 번호 (자동 증가) |
| `session_id` | 어떤 세션에서 발생한 이벤트인지 |
| `visitor_id` | 어떤 방문자의 이벤트인지 |
| `event_type` | 이벤트 유형 (product_view, add_to_cart 등) |
| `product_id` | 관련 상품 ID |
| `product_name` | 관련 상품명 |
| `product_price` | 상품 가격 |
| `quantity` | 수량 |
| `timestamp` | 이벤트 발생 시각 |
| `metadata` | 추가 정보 (JSON 형식) |
| `created_at` | 데이터 생성 시각 |

---

## 5. 구매 전환 테이블
**테이블명**: `conversions`  
**용도**: 실제 구매가 발생한 내역을 저장 (매출 분석의 핵심)

### 📌 필드 설명
| 필드명 | 설명 |
|--------|------|
| `id` | 전환 고유 번호 (자동 증가) |
| `session_id` | 어떤 세션에서 구매했는지 |
| `visitor_id` | 누가 구매했는지 |
| `order_id` | 주문 번호 (Cafe24 주문번호) |
| `total_amount` | 주문 총액 (할인 전 금액) |
| `product_count` | 구매한 상품 개수 |
| `discount_amount` | 할인 금액 (쿠폰 등) |
| `mileage_used` | 사용한 적립금 |
| `shipping_fee` | 배송비 |
| `final_payment` | 최종 결제 금액 (실제 지불한 금액) |
| `order_status` | 주문 상태 (confirmed: 확정, cancelled: 취소, refunded: 환불) |
| `cancelled_at` | 취소/환불 발생 시각 |
| `refund_amount` | 환불 금액 (부분 환불 포함) |
| `synced_at` | Google Sheets에서 마지막으로 동기화한 시각 |
| `timestamp` | 구매 발생 시각 |
| `utm_source` | 구매로 이어진 광고 출처 |
| `utm_campaign` | 구매로 이어진 광고 캠페인 |
| `utm_params` | 구매 시점의 모든 UTM 파라미터 (JSON) |
| `created_at` | 데이터 생성 시각 |

---

## 6. 실시간 방문자 테이블
**테이블명**: `realtime_visitors`  
**용도**: 현재 쇼핑몰을 보고 있는 사람들을 실시간으로 표시

### 📌 필드 설명
| 필드명 | 설명 |
|--------|------|
| `visitor_id` | 방문자 고유 번호 |
| `current_url` | 현재 보고 있는 페이지 URL |
| `last_activity` | 마지막 활동 시각 (5분 넘으면 자동 삭제) |
| `device_type` | 접속 기기 종류 |

---

## 7. UTM 터치포인트 테이블
**테이블명**: `utm_sessions`  
**용도**: 고객이 구매하기까지 거친 모든 광고 터치포인트를 기록 (멀티터치 분석)

### 📌 필드 설명
| 필드명 | 설명 |
|--------|------|
| `id` | 터치포인트 고유 번호 (자동 증가) |
| `session_id` | 어떤 세션인지 |
| `visitor_id` | 어떤 방문자인지 |
| `utm_source` | 광고 출처 |
| `utm_medium` | 광고 매체 |
| `utm_campaign` | 광고 캠페인명 |
| `utm_params` | 모든 UTM 파라미터 (JSON) |
| `page_url` | 진입한 페이지 URL |
| `entry_timestamp` | 진입 시각 |
| `exit_timestamp` | 이탈 시각 |
| `duration_seconds` | 체류 시간 (초) |
| `pageview_count` | 본 페이지 수 |
| `sequence_order` | 터치포인트 순서 (1: 첫 접촉, 2: 두 번째 접촉...) |
| `created_at` | 데이터 생성 시각 |

### 💡 사용 예시
고객이 구매까지 다음과 같이 접촉했다면:
1. Instagram 광고 클릭 → `sequence_order = 1`
2. 일주일 후 Facebook 광고 클릭 → `sequence_order = 2`
3. 다음 날 Google 검색으로 재방문 후 구매 → `sequence_order = 3`

이 모든 과정이 기록되어 "어떤 광고가 구매에 기여했는지" 분석 가능

---

## 8. 광고비 관리 테이블
**테이블명**: `ad_spend`  
**용도**: 각 광고 캠페인에 얼마를 썼는지 기록하여 ROAS 계산

### 📌 필드 설명
| 필드명 | 설명 |
|--------|------|
| `id` | 광고비 기록 고유 번호 (자동 증가) |
| `utm_source` | 광고 플랫폼 (facebook, instagram, google 등) |
| `utm_campaign` | 캠페인명 (필수) |
| `spend_amount` | 광고비 (원 단위) |
| `currency` | 통화 종류 (기본: KRW) |
| `period_start` | 광고 집행 시작일 (선택) |
| `period_end` | 광고 집행 종료일 (선택) |
| `note` | 메모 (예: "1월 신년 프로모션") |
| `created_at` | 데이터 생성 시각 |
| `updated_at` | 데이터 수정 시각 |

### 💡 ROAS 계산 방법
```
ROAS = (해당 캠페인 총 매출) / (광고비) × 100%

예) 광고비 100만원으로 500만원 매출 → ROAS 500%
```

---

## 9. Cafe24 토큰 관리 테이블
**테이블명**: `cafe24_token`  
**용도**: Cafe24 API를 사용하기 위한 인증 토큰 저장 및 자동 갱신

### 📌 필드 설명
| 필드명 | 설명 |
|--------|------|
| `idx` | 토큰 기록 고유 번호 (자동 증가) |
| `access_token` | 접근 토큰 (2시간 유효) |
| `refresh_token` | 갱신 토큰 (2주 유효, 갱신 시마다 새로 발급) |
| `issued_date` | 발급 시각 |
| `expire_date` | 만료 시각 |
| `created_at` | 데이터 생성 시각 |

### 💡 작동 방식
- **Access Token**: 2시간마다 만료되어 자동으로 갱신
- **Refresh Token**: 2주마다 갱신되며, 갱신 시마다 새로운 토큰 발급
- 시스템이 자동으로 만료 시각을 확인하여 토큰 갱신

---

## 10. URL 매핑 테이블
**테이블명**: `url_mappings`  
**용도**: 복잡한 URL을 알아보기 쉬운 한글 이름으로 매핑

### 📌 필드 설명
| 필드명 | 설명 |
|--------|------|
| `id` | 매핑 고유 번호 (자동 증가) |
| `url` | 정제된 URL (내부 통계 집계용) |
| `korean_name` | 사용자가 지정한 한글 이름 (예: "겨울신상 상품 페이지") |
| `source_type` | 등록 방식 (auto: 자동 수집, manual: 수동 등록) |
| `url_conditions` | 복합 URL 조건 (여러 URL을 하나로 묶을 때 사용, JSON) |
| `is_excluded` | 제외 여부 (통계에서 제외할 URL인지) |
| `created_at` | 데이터 생성 시각 |
| `updated_at` | 데이터 수정 시각 |

### 💡 사용 예시
```
URL: https://m.moadamda.com/product/detail?no=12345
매핑명: 겨울 코트 상세 페이지

→ 대시보드에서 복잡한 URL 대신 "겨울 코트 상세 페이지"로 표시
```

### 💡 복합 URL 조건 (url_conditions)
여러 상품을 하나의 그룹으로 묶어서 분석 가능:
```json
{
  "operator": "OR",
  "groups": [
    {
      "base_url": "https://m.moadamda.com/product/detail",
      "params": {
        "operator": "AND",
        "conditions": [
          {"key": "no", "value": "1001"}
        ]
      }
    },
    {
      "base_url": "https://m.moadamda.com/product/detail",
      "params": {
        "operator": "AND",
        "conditions": [
          {"key": "no", "value": "2003"}
        ]
      }
    }
  ]
}
```
→ 상품번호 1001과 2003을 "프리미엄 상품군"으로 묶어서 통계 분석

---

## 🔗 테이블 간 관계

```
visitors (방문자)
    ├── sessions (세션)
    │   ├── pageviews (페이지뷰)
    │   ├── events (이벤트)
    │   └── conversions (구매)
    └── utm_sessions (UTM 터치포인트)
        └── conversions (구매)

ad_spend (광고비) ←→ conversions (구매)
  ↓ utm_campaign으로 연결
  ↓ ROAS 계산

url_mappings (URL 매핑) ←→ pageviews (페이지뷰)
  ↓ URL 기반으로 연결
  ↓ 페이지별 통계 표시

cafe24_token (토큰)
  ↓ API 인증에 사용
  ↓ 주문 데이터 동기화
```

---

## 📊 주요 분석 지표 계산 방법

### 1️⃣ ROAS (광고 수익률)
```
ROAS = (캠페인별 총 매출 / 광고비) × 100%

데이터 출처:
- 매출: conversions 테이블의 final_payment 합계
- 광고비: ad_spend 테이블의 spend_amount
- 연결: utm_campaign으로 매칭
```

### 2️⃣ 전환율
```
전환율 = (구매 세션 수 / 전체 세션 수) × 100%

데이터 출처:
- 구매 세션: sessions 테이블에서 is_converted = true
- 전체 세션: sessions 테이블 전체
```

### 3️⃣ 이탈률
```
이탈률 = (이탈 세션 수 / 전체 세션 수) × 100%

데이터 출처:
- 이탈 세션: sessions 테이블에서 is_bounced = true
- 이탈 정의: pageview_count = 1 (한 페이지만 보고 나감)
```

### 4️⃣ 평균 체류 시간
```
평균 체류 시간 = SUM(duration_seconds) / COUNT(sessions)

데이터 출처:
- sessions 테이블의 duration_seconds 평균
```

### 5️⃣ 멀티터치 기여도
```
각 터치포인트의 매출 기여도 계산

데이터 출처:
- utm_sessions: 고객의 광고 접촉 이력
- conversions: 최종 구매 금액
- 분석: First Touch, Mid Touch, Last Touch별 기여도 분배
```

---

## 🔐 데이터 보안 및 개인정보

### 저장하지 않는 정보
- ❌ 고객 실명
- ❌ 연락처 (전화번호, 이메일)
- ❌ 결제 카드 정보
- ❌ 배송지 주소

### 저장하는 정보
- ✅ 익명화된 방문자 ID (무작위 생성)
- ✅ IP 주소 (통계 분석용)
- ✅ 브라우저/기기 정보
- ✅ 페이지 방문 기록
- ✅ 구매 금액 (주문번호만)

---

## 📌 버전 이력
| 날짜 | 버전 | 변경 사항 |
|------|------|----------|
| 2025-10-22 | v1.0 | 초기 데이터베이스 설계 |
| 2025-10-27 | v1.1 | 주문 상태 추적 추가 (취소/환불) |
| 2025-10-22 | v1.2 | 동적 UTM 파라미터 지원 (utm_params JSONB) |
| 2025-11-13 | v1.3 | 복합 URL 조건 매핑 추가 (url_conditions) |

---

**문서 작성**: Codex AI Assistant  
**최종 업데이트**: 2025-11-13

