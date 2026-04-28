# 노아마케팅그룹 라이브 후 작업 체크리스트

> 사이트: https://noahgroup.co.kr  
> 저장소: cccompanymaster/cc-  
> 작성일: 2026-04-28

---

## 🟥 P0 — 오늘 안에 끝내기 (사이트 안정화)

### [ ] 1. Cloudflare 최종 최적화 (소요 10분)
- [ ] SSL/TLS → Overview → **Full (strict)** 선택
- [ ] SSL/TLS → Edge Certificates → **Always Use HTTPS** ON
- [ ] SSL/TLS → Edge Certificates → **Automatic HTTPS Rewrites** ON
- [ ] SSL/TLS → Edge Certificates → **Minimum TLS Version: TLS 1.2** 이상
- [ ] Speed → Optimization → **Brotli** ON
- [ ] Speed → Optimization → **Auto Minify** (HTML/CSS/JS 모두) ON
- [ ] Caching → Configuration → **Browser Cache TTL: 4 hours**
- [ ] Caching → Tiered Cache → **Smart Tiered Cache** ON

### [ ] 2. 동작 검증 (소요 5분)
- [ ] https://noahgroup.co.kr 메인 정상
- [ ] http://noahgroup.co.kr → https 자동 리다이렉트
- [ ] https://www.noahgroup.co.kr 접속 정상
- [ ] 모바일 사파리/크롬에서 ROI 계산기 정상 동작
- [ ] 데모 대시보드 6개 고객사 클릭 정상
- [ ] 사칭 사기 팝업 등장 정상
- [ ] 하단 상담 배너 정상 표시
- [ ] 결제 모달 / 문의 모달 X 버튼 정상 작동
- [ ] 카카오톡으로 링크 공유 시 미리보기 카드 정상

### [ ] 3. 가비아 도메인 자동연장 (소요 2분)
- [ ] 가비아 마이페이지 → 도메인 관리 → noahgroup.co.kr
- [ ] **자동연장** 신청
- [ ] 결제수단 등록

---

## 🟧 P1 — 이번 주 (검색 노출 시작)

### [ ] 4. Google Search Console 등록 (소요 15분)
- [ ] https://search.google.com/search-console 접속
- [ ] 속성 추가 → **URL 접두어** → `https://noahgroup.co.kr`
- [ ] 소유권 확인 방법: **HTML 태그** 선택
- [ ] 표시되는 메타태그 복사 → 클로드한테 `index.html` `<head>`에 추가 요청
- [ ] 사이트맵 제출: `sitemap.xml`
- [ ] URL 검사 → `https://noahgroup.co.kr/` → 색인 요청

### [ ] 5. Naver Search Advisor 등록 (소요 15분, 한국 SEO 필수)
- [ ] https://searchadvisor.naver.com 접속
- [ ] 사이트 등록 → `https://noahgroup.co.kr`
- [ ] HTML 태그로 소유권 확인 → 메타태그를 클로드한테 전달
- [ ] **요청 → 사이트맵 제출**: `sitemap.xml`
- [ ] **요청 → RSS 제출**: `feed.xml`
- [ ] 검증 → robots.txt 확인

### [ ] 6. Bing Webmaster Tools 등록 (소요 5분, ChatGPT 검색용)
- [ ] https://www.bing.com/webmasters 접속
- [ ] **Import from Google Search Console** 선택 (가장 빠름)
- [ ] 또는 메타태그로 직접 인증

### [ ] 7. Daum 검색등록 (소요 3분)
- [ ] https://register.search.daum.net 접속
- [ ] 무료 등록 신청

---

## 🟨 P2 — 이번 주 (분석 시스템 구축)

### [ ] 8. Google Analytics 4 (GA4) 설치 (소요 10분)
- [ ] https://analytics.google.com 속성 만들기
- [ ] 측정 ID 발급 (`G-XXXXXXXXXX`)
- [ ] 측정 ID를 클로드한테 전달 → `<head>`에 GA4 코드 삽입 요청

### [ ] 9. 네이버 애널리틱스 (소요 10분, 한국 사용자 분석)
- [ ] https://analytics.naver.com 등록
- [ ] 추적 코드 발급 → 클로드한테 전달

### [ ] 10. Microsoft Clarity (소요 10분, 무료 히트맵+세션 영상)
- [ ] https://clarity.microsoft.com 가입
- [ ] 프로젝트 생성 → 추적 코드 발급
- [ ] 추적 코드 클로드한테 전달

---

## 🟩 P3 — 다음 주 (마케팅 자산 + 모니터링)

### [ ] 11. PageSpeed Insights 측정 (소요 5분)
- [ ] https://pagespeed.web.dev 접속
- [ ] `https://noahgroup.co.kr` 입력 → 분석
- [ ] 모바일·데스크톱 점수 캡처
- [ ] 90점 미만이면 → 결과 클로드한테 보내서 추가 최적화

### [ ] 12. 소셜 카드 미리보기 검증 (소요 10분)
- [ ] **Facebook**: https://developers.facebook.com/tools/debug/
- [ ] **Twitter/X**: 트윗 작성창에 링크 붙여넣기 → 카드 확인
- [ ] **카카오톡**: 본인에게 메시지 보내서 미리보기 확인
- [ ] **LinkedIn**: https://www.linkedin.com/post-inspector/
- [ ] 잘못 표시되면 클로드한테 og:image, og:title 수정 요청

### [ ] 13. UptimeRobot 사이트 다운 모니터링 (소요 10분, 무료)
- [ ] https://uptimerobot.com 가입 (무료 50개 모니터)
- [ ] HTTP(s) 모니터 추가 → `https://noahgroup.co.kr`
- [ ] 5분 간격 체크 + 다운 시 메일 알림

### [ ] 14. 카카오 비즈니스 채널 연동 (선택)
- [ ] 카카오 채널 관리자센터 → 사이트 인증
- [ ] noahgroup.co.kr 연결

### [ ] 15. 회사 메일 (`@noahgroup.co.kr`) 발급 (선택)
- [ ] **옵션 A** (가장 저렴, 무료): Cloudflare Email Routing → 개인 Gmail로 포워딩
- [ ] **옵션 B** (정식): Google Workspace ($6/월/계정)
- [ ] **옵션 C**: 가비아 메일 (연 11,000원)

### [ ] 16. 백업 (소요 5분)
- [ ] Cloudflare → DNS → **Export** → DNS 설정 백업 다운로드
- [ ] GitHub은 자체 백업 (별도 작업 불필요)

---

## ⬛ P4 — 운영 단계 (장기·반복)

### [ ] 17. 콘텐츠 발행 (주 1~2회)
- [ ] 새 블로그 글 아이디어 → 클로드한테 작성 요청
- [ ] 발행 후 sitemap.xml + feed.xml 업데이트는 클로드가 자동 처리
- [ ] 발행 후 Google Search Console에서 색인 요청

### [ ] 18. 백링크 확보 (지속)
- [ ] 카카오 채널 프로필 → noahgroup.co.kr 링크
- [ ] 인스타그램 바이오 → 링크
- [ ] 유튜브 채널 설명란 → 링크
- [ ] 네이버 블로그·티스토리에 글 기고 → 본문에 링크

### [ ] 19. 사용자 행동 분석 → 개선 (월 1회)
- [ ] Clarity 데이터 확인 → 어디서 이탈하는지 파악
- [ ] GA4 → 전환율 확인
- [ ] 결과 클로드한테 보내서 A/B 테스트 또는 UI 개선 요청

---

## 🤖 클로드한테 줄 프롬프트 템플릿

각 작업 완료 후, 아래 템플릿을 복사해서 클로드한테 보내세요.

---

### ▶ 검색엔진 메타태그 추가 (작업 4·5·6 완료 후)

```
검색엔진 인증 메타태그 추가해줘.

- Google Search Console: <meta name="google-site-verification" content="여기에-내가-받은-토큰">
- Naver Search Advisor: <meta name="naver-site-verification" content="여기에-내가-받은-토큰">
- Bing Webmaster: <meta name="msvalidate.01" content="여기에-내가-받은-토큰">

index.html, index-en.html, index-zh.html, impact-2026.html, products.html 등 
주요 HTML 파일 <head>에 모두 추가해줘. 
이미 placeholder 주석이 있으니 그 자리에 채워넣으면 돼.

작업 후 커밋·푸시까지 해줘.
```

---

### ▶ Google Analytics 4 설치 (작업 8 완료 후)

```
Google Analytics 4 측정 ID: G-XXXXXXXXXX

이 ID로 GA4 추적 코드를 사이트 모든 HTML 파일 <head>에 추가해줘.
SPA가 아니라 정적 사이트이므로 페이지뷰 자동 수집이 기본.

대상 파일:
- index.html, index-en.html, index-zh.html
- products.html, products-en.html, products-zh.html
- privacy.html, terms.html, impact-2026.html, 404.html
- articles/ 폴더 전체
- authors/ 폴더 전체

성능 영향 최소화를 위해 async 로딩 + defer 적용.
작업 후 커밋·푸시.
```

---

### ▶ 네이버 애널리틱스 + Clarity 추가 (작업 9·10 완료 후)

```
네이버 애널리틱스 코드와 Microsoft Clarity 코드 추가해줘.

네이버 애널리틱스:
[여기에 발급받은 전체 코드 붙여넣기]

Microsoft Clarity:
[여기에 발급받은 전체 코드 붙여넣기]

GA4와 같은 위치(<head> 안, GA4 바로 다음)에 추가하고
모든 HTML 파일에 일괄 적용.
작업 후 커밋·푸시.
```

---

### ▶ PageSpeed 점수 90 미만 → 최적화 (작업 11 결과 안 좋을 때)

```
PageSpeed Insights 측정 결과:
- 모바일: 점수 XX
- 데스크톱: 점수 XX
- 주요 지적사항: 
  1. [여기에 PageSpeed가 알려준 항목 복붙]
  2. ...

이 항목들을 우선순위로 최적화해줘. 
LCP·CLS·INP 메트릭 개선 중심으로.
작업 후 다시 측정 가능하도록 가이드도 같이 줘.
```

---

### ▶ 소셜 카드 미리보기 깨질 때 (작업 12)

```
[Facebook/Twitter/Kakao 등] 미리보기에서 [어떤 부분이] 잘못 표시됨.

스크린샷:
[캡처 첨부]

og:image, og:title, og:description 등을 점검하고 수정해줘.
이미지 비율 1.91:1 (1200x630) 권장.
모든 페이지의 OG 태그 일괄 점검·수정.
작업 후 커밋·푸시.
```

---

### ▶ 새 블로그 글 발행 (P4-17 반복)

```
새 블로그 글 작성해줘.

주제: [예: "2026년 네이버 광고 최저 입찰가 가이드"]
타겟 독자: [예: "광고 예산 1,000만원 이하 자영업자"]
키워드: [예: "네이버 광고 입찰가, 최저가, 노출 전략"]
분량: 2,000자 이상
스타일: 기존 articles/ 폴더 톤 유지

JSON-LD Article 스키마, FAQ 스키마 포함.
작성 후 sitemap.xml, feed.xml, articles/index.html 자동 업데이트.
저자: [예: "김시우" — authors/kim-siwoo.html 기준]
발행일: [오늘 날짜]
작업 후 커밋·푸시.
```

---

### ▶ A/B 테스트 또는 UI 개선 (P4-19)

```
사용자 행동 분석 결과:
- Clarity 히트맵: [어떤 영역 클릭 많음, 어디서 이탈 많음]
- GA4 전환율: [예: 메인 → 문의 폼 도달률 X%]
- 추정 원인: [예: "ROI 계산기 결과를 보고도 견적 버튼 클릭률 낮음"]

개선 방향: [예: "결과 카드 강조 + CTA 카피 변경"]
A/B 테스트보다는 직접 개선 적용해줘 (트래픽 부족하면 통계 신뢰도 낮음).
작업 후 커밋·푸시.
```

---

## 🆘 문제 발생 시

### 사이트 다운됐을 때
1. https://noahgroup.co.kr 접속 안 됨 확인
2. https://cccompanymaster.github.io/cc- 직접 접속해보기 (GitHub Pages 직접)
3. → 여기도 안 되면 GitHub Pages 자체 문제: GitHub Status (status.github.com) 확인
4. → 여기는 되면 Cloudflare 또는 DNS 문제: Cloudflare 대시보드 → Analytics → 트래픽 흐름 확인
5. UptimeRobot 알림 메일 받았으면 다운 시각 기록 → 클로드한테 진단 요청

### 검색에 안 잡힐 때 (1주 후에도)
1. Google Search Console → 페이지 → 색인 생성 보고서 확인
2. robots.txt 차단 여부 확인 (https://noahgroup.co.kr/robots.txt)
3. 사이트맵 제출됐는지 재확인
4. 클로드한테 `site:noahgroup.co.kr` 검색 결과 알려주고 진단 요청

### Cloudflare에서 인증서 만료 경고
- Let's Encrypt는 90일 자동갱신이지만 Cloudflare 프록시 OFF되면 갱신 실패 가능
- 평소 프록시 ON 상태 유지하면 문제없음

---

## 📝 진행 상황 기록

| 작업 | 시작 | 완료 | 비고 |
|------|------|------|------|
| 1. Cloudflare 최적화 | | | |
| 2. 동작 검증 | | | |
| 3. 도메인 자동연장 | | | |
| 4. Google Search Console | | | 토큰: |
| 5. Naver Search Advisor | | | 토큰: |
| 6. Bing Webmaster | | | |
| 7. Daum 검색등록 | | | |
| 8. GA4 | | | 측정 ID: |
| 9. 네이버 애널리틱스 | | | |
| 10. Clarity | | | 프로젝트 ID: |
| 11. PageSpeed | | | 점수: |
| 12. 소셜 카드 검증 | | | |
| 13. UptimeRobot | | | |
| 14. 카카오 채널 연동 | | | |
| 15. 회사 메일 발급 | | | |
| 16. 백업 | | | |

---

**우선순위 추천**: P0 → P1 (4·5번) → P2 (8번) 순으로 진행하면 1~2주 안에 SEO 노출 시작합니다.
