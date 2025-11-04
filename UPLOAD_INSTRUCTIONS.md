# 📦 Tracker 업로드 가이드

## 현재 버전: **v001**

---

## 🚀 업로드 절차

### 1. 파일 업로드
- **파일 경로:** `C:\analysis\moadamda-analytics\tracker\build\tracker-v001.js`
- **업로드 위치:** 카페24 파일 관리자 → `/web/tracker-v001.js`

### 2. HTML 스크립트 태그 업데이트

**PC 쇼핑몰 & 모바일 쇼핑몰 모두:**

기존 스크립트 태그를 찾아서:
```html
<script src="/web/tracker-v2024.js"></script>
```

새 버전으로 교체:
```html
<script src="/web/tracker-v001.js"></script>
```

### 3. 캐시 클리어
- 브라우저 캐시 완전 삭제 (Ctrl + Shift + Delete)
- 시크릿 모드로 테스트

### 4. 테스트
시크릿 모드에서 F12 콘솔 확인:
```
[MA] Initializing Moadamda Analytics...
[MA] Product page detected
[MA] Add to cart button clicked
[MA] Sending event immediately: add_to_cart  ← 이 메시지가 나와야 함!
[MA] Event sent immediately: add_to_cart
```

---

## 📝 버전 관리

### v001 (2025-01-18)
- **기능:** 장바구니 이벤트 즉시 전송
- **변경사항:**
  - `sendImmediately()` 함수 추가
  - 장바구니 버튼 클릭 시 즉시 서버로 전송
  - `product_submit` 인터셉트 시 즉시 전송
  - Basket AJAX 감지 시 즉시 전송

---

## ⚠️ 주의사항

1. **파일명을 정확히 확인하세요:** `tracker-v001.js`
2. **이전 버전 파일 삭제:**
   - `/web/tracker-v2024.js` (있다면 삭제)
   - `/web/tracker-v2.js` (있다면 삭제)
3. **HTML 스크립트 태그를 꼭 업데이트하세요**
4. **업로드 후 반드시 캐시를 클리어하세요**

---

## 🔄 다음 업데이트 시

다음 버전은 `tracker-v002.js`가 될 것입니다.

