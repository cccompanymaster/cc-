# 노아 사이트 운영 체크리스트

> 사이트: https://noahgroup.co.kr  
> 저장소: cccompanymaster/cc- · 작업 브랜치 `claude/fix-url-redirect-42f6N`  
> 배포: 작업 브랜치에 push하면 GitHub Actions가 gh-pages로 자동 배포하고, 바뀐 페이지를 IndexNow(빙·네이버)로 자동 통지  
> 처음 작성 2026-04-28 · **최종 갱신 2026-10-09**

---

## 📊 지금 상태 한눈에 (2026-10-09)

| 항목 | 상태 | 근거·메모 |
|---|---|---|
| 자동 배포 + IndexNow | ✅ | `.github/workflows/auto-deploy.yml` |
| Google Search Console | ✅ 등록됨 | 서치콘솔 경고 해소 작업 이력(2026-09) |
| 네이버 서치어드바이저 | ✅ 소유확인 | `naver-site-verification` 메타 |
| Bing 웹마스터 도구 | ✅ 소유확인 | `BingSiteAuth.xml` |
| GA4 | ✅ 전 페이지 | `G-9J2V6KLGLG` + 클릭·인트로 이벤트(아래 목록) |
| 네이버 애널리틱스 | ❌ 미설치 | 코드 발급 필요 |
| Microsoft Clarity | ❌ 미설치 | 코드 발급 필요 |
| 공유 미리보기 이미지 | ✅ 교체 완료 | 메인 `og-noah-glass.png` + 칼럼·카테고리 47장 — 캐시 초기화 필요 |
| 속도 (로컬 Lighthouse 모바일) | 한국어 메인 99 · 영문 메인 80 | 실제 점수는 pagespeed.web.dev에서 확인 필요 |
| Cloudflare·도메인 자동연장·UptimeRobot·Daum | ❓ 확인 필요 | 계정이 있어야 확인 가능 |

---

## 🟥 지금 해 주시면 좋은 일 (2026-10-09 작업 후속)

### [ ] 1. 공유 미리보기 캐시 초기화 (5분)
- [ ] 카카오 공유 디버거: https://developers.kakao.com/tool/debugger/sharing → `https://noahgroup.co.kr` 캐시 초기화
- [ ] 페이스북 공유 디버거: https://developers.facebook.com/tools/debug → 같은 주소 "다시 스크랩"
- 메인 이미지는 주소가 그대로라 초기화가 필요합니다. 칼럼 이미지는 주소가 바뀌어(.jpg) 자동으로 새로 가져갑니다.

### [ ] 2. 실제 속도 측정 (5분)
- [ ] https://pagespeed.web.dev 에서 `https://noahgroup.co.kr` 와 `https://noahgroup.co.kr/index-en.html` 모바일 측정
- [ ] 점수·LCP를 클로드한테 전달 (아래 템플릿)

### [ ] 3. GA4 설정 두 가지 (10분)
- [ ] 관리(톱니바퀴) → 데이터 표시 → 맞춤 정의 → 맞춤 측정기준 만들기: 이름 `클릭 위치`, 범위 `이벤트`, 매개변수 `cta_location`
- [ ] 관리 → 데이터 표시 → 이벤트 → 아래 이벤트를 '주요 이벤트로 표시': `cta_click` · `contact_call` · `contact_kakao` · `contact_naver_talk` · `generate_lead` (이벤트가 한 번 이상 기록된 뒤에 목록에 나타남)
- 사이트가 보내는 이벤트

| 이벤트 | 언제 | 매개변수 |
|---|---|---|
| `intro_view` | 메인 인트로가 나타남 | — |
| `intro_skip` | 인트로를 건너뜀 | `method`(button·click·key·scroll), `seconds` |
| `intro_complete` | 인트로를 끝까지 봄 | — |
| `cta_click` | 문의·무료 진단 등 CTA 클릭 | `label`, `cta_location`, `page` |
| `contact_call` / `contact_kakao` / `contact_naver_talk` | 전화·카카오·톡톡 클릭 | `cta_location`, `page` |
| `click_blog` | 네이버 블로그 링크 클릭 | `cta_location`, `page` |
| `generate_lead` | 문의 폼 제출 | `method` |

- 인트로 건너뛰기 비율 = `intro_skip` ÷ `intro_view`
- 인트로는 검색 결과에서 들어온 방문자에게는 나오지 않습니다(직접 입력·공유 링크 첫 방문자만, 24시간에 1회).

### [ ] 4. 새 칼럼 색인 요청 (5분)
- [ ] 서치콘솔 URL 검사 → `https://noahgroup.co.kr/guide/intro-screen-seo.html` → 색인 생성 요청
- [ ] 서치어드바이저 → 요청 → 웹 페이지 수집 → 같은 주소

### [ ] 5. 칼럼 주제 우선순위용 데이터 (10분)
- [ ] 서치콘솔 → 실적 → 검색어 탭 → 최근 28일 → 내보내기(CSV) → 클로드한테 전달
- 받으면 `.claude/seo/content/backlog.md`를 "노출 있고 순위 5~15위" 질문 순으로 다시 정렬합니다.
- [ ] (선택) 보류 중인 광고 단가 글 4건(브랜드검색·플레이스광고·인스타그램·카카오 비즈보드)은 광고관리 화면의 실제 단가표 캡처를 주시면 검증된 수치로 작성합니다.

### [ ] 6. 2026-10-23 재측정
- [ ] 새 칼럼의 색인 여부·노출·클릭 확인, "홈페이지 인트로 SEO" 질문을 ChatGPT 검색·Perplexity·네이버에 물어 인용되는지 확인

---

## 🟧 계정이 필요해 아직 확인 못 한 일

### [ ] Cloudflare 최종 최적화 (10분)
- [ ] SSL/TLS → Overview → **Full (strict)**
- [ ] SSL/TLS → Edge Certificates → **Always Use HTTPS** ON · **Automatic HTTPS Rewrites** ON · **Minimum TLS 1.2**
- [ ] Speed → Optimization → **Brotli** ON (※ Auto Minify는 Cloudflare에서 종료된 기능이라 생략)
- [ ] Caching → Browser Cache TTL **4 hours** · Tiered Cache **Smart Tiered Cache** ON

### [ ] 가비아 도메인 자동연장 (2분)
- [ ] 마이페이지 → 도메인 관리 → noahgroup.co.kr → **자동연장** + 결제수단 등록

### [ ] 네이버 서치어드바이저 제출 상태 확인 (5분)
- [ ] 요청 → 사이트맵 제출: `https://noahgroup.co.kr/sitemap.xml` (사이트맵 인덱스 — 섹션별 사이트맵 4개를 포함)
- [ ] 요청 → RSS 제출: `https://noahgroup.co.kr/feed.xml`

### [ ] Daum 검색등록 (3분)
- [ ] https://register.search.daum.net 무료 등록

### [ ] 네이버 애널리틱스 · Microsoft Clarity (각 10분)
- [ ] https://analytics.naver.com 등록 → 추적 코드 발급
- [ ] https://clarity.microsoft.com 프로젝트 생성 → 추적 코드 발급 (히트맵·세션 영상 무료)
- [ ] 코드를 클로드한테 전달 (아래 템플릿) — 설치는 클로드가 전 페이지에 적용

### [ ] UptimeRobot 다운 알림 (10분)
- [ ] https://uptimerobot.com → HTTP(s) 모니터 `https://noahgroup.co.kr` · 5분 간격 · 메일 알림

### [ ] 그 밖에 (선택)
- [ ] 카카오 비즈니스 채널 관리자센터 → 사이트 인증 → noahgroup.co.kr 연결
- [ ] 회사 메일(@noahgroup.co.kr): Cloudflare Email Routing(무료 포워딩) · Google Workspace · 가비아 메일 중 선택
- [ ] Cloudflare → DNS → Export로 DNS 설정 백업

---

## ✅ 완료 기록

| 날짜 | 한 일 |
|---|---|
| 2026-08~09 | GA4 전 페이지 설치 · 네이버·Bing 소유확인 · 서치콘솔 등록·경고 해소 · 사이트맵 인덱스·섹션별 RSS · IndexNow 자동 통지 · llms.txt/llms-full.txt · 구조화 데이터 정비 |
| 2026-10-03 | 메인 진입 인트로(유리 오브 로고) · 버튼 유리 효과 · 메인 공유 이미지 교체 |
| 2026-10-09 | 칼럼 공유 이미지의 잘못된 도메인 수정 → 47장 아이보리 디자인으로 재제작 · 구조화 데이터 로고 정정 |
| 2026-10-09 | 인트로: 24시간 1회 · 검색 결과 유입 제외 · 로봇 구분 제거 · 첫 화면 연출 재생 · 영문·중문 메인 적용 |
| 2026-10-09 | GA4 클릭·인트로 이벤트 전 페이지(`js/track.js`, 232페이지) |
| 2026-10-09 | 속도 개선: 한국어 메인 Lighthouse 93 → 99 (인트로 있을 때) |
| 2026-10-09 | 영문·중문·상품·아티클·저자 60페이지 아이보리 디자인 통일(`css/theme-ivory.css`) · 글자 대비 보정 |
| 2026-10-09 | '본문 바로가기' 링크 오류 수정 · 안 쓰는 파일 정리(예전 메인 `index-classic.html` 등 7개) |
| 2026-10-09 | 새 가이드 1편 발행 + 콘텐츠 인벤토리·백로그(`.claude/seo/content/`) |

- 예전 체크리스트의 '동작 검증' 중 ROI 계산기·데모 대시보드·사칭 사기 팝업은 현재 사이트에 없는 예전 메인 기능이라 목록에서 뺐습니다.

---

## 🟩 운영 (반복)

- **콘텐츠 (주 1~2회)**: `.claude/seo/content/backlog.md` 순서대로 — 질문 하나 = 페이지 하나, 발행 게이트 통과 후 발행
- **월 1회**: GA4에서 문의 클릭 위치(`cta_location`)·인트로 건너뛰기 비율 확인 → 개선 요청
- **분기 1회**: 콘텐츠 인벤토리 점검 — 90일 이상 갱신 없는 글(2026-10-09 기준 42편)부터 갱신
- **백링크(지속)**: 카카오 채널·인스타그램·유튜브 프로필에 사이트 링크, 네이버 블로그 글에는 요약 + 사이트 원문 링크 1~2개 (구매·품앗이 백링크는 하지 않음)

---

## 🤖 클로드한테 줄 프롬프트 템플릿

### ▶ 네이버 애널리틱스 + Clarity 추가

```
네이버 애널리틱스 코드와 Microsoft Clarity 코드 추가해줘.

네이버 애널리틱스:
[여기에 발급받은 전체 코드 붙여넣기]

Microsoft Clarity:
[여기에 발급받은 전체 코드 붙여넣기]

GA4 바로 다음 위치에, 모든 HTML 파일에 일괄 적용.
작업 후 커밋·푸시.
```

### ▶ PageSpeed 결과 전달

```
PageSpeed Insights 측정 결과 (모바일):
- 한국어 메인: 점수 XX / LCP X.X초
- 영문 메인: 점수 XX / LCP X.X초
- 주요 지적사항: [PageSpeed 화면의 항목 복붙]

실제 방문자 기준(필드 데이터)이 나쁜 항목부터 개선해줘. 작업 후 커밋·푸시.
```

### ▶ 공유 미리보기가 이상할 때

```
[카카오/페이스북/X] 미리보기에서 [어떤 부분이] 잘못 나와.
주소: [문제 페이지 주소]
스크린샷: [캡처 첨부]

og 태그를 점검하고, 이미지가 문제면 .claude/seo/og/ 생성기로 다시 만들어줘.
작업 후 커밋·푸시.
```

### ▶ 새 칼럼 발행

```
.claude/seo/content/backlog.md의 [번호]번 질문으로 칼럼 써줘.
(또는) 질문: [사람들이 검색창에 치는 문장 그대로]
근거 자료: [우리 데이터·캡처·공식 문서 링크가 있으면 첨부]

브리프 다섯 줄(질문·직답·근거·하위 질문·내부 링크) 먼저 보여주고,
발행 게이트 통과시킨 뒤 목록·사이트맵·RSS·llms까지 반영해서 커밋·푸시.
```

### ▶ GA4 데이터로 개선

```
GA4 최근 28일:
- cta_click 위치별 클릭 수: [예: header 120 · ownbiz 45 · final-cta 30 ...]
- 인트로 건너뛰기 비율: [intro_skip ÷ intro_view]
- 문의 폼 제출(generate_lead): [건수]
- (Clarity 설치 후) 히트맵에서 눈에 띄는 점: [메모]

클릭이 적은 위치의 문구·배치를 개선해줘. 작업 후 커밋·푸시.
```

---

## 🆘 문제 발생 시

### 사이트 다운됐을 때
1. https://noahgroup.co.kr 접속 안 됨 확인
2. https://cccompanymaster.github.io/cc- 직접 접속 (GitHub Pages 직접)
3. 여기도 안 되면 GitHub 쪽 문제 → https://www.githubstatus.com 확인
4. 여기는 되면 Cloudflare 또는 DNS 문제 → Cloudflare 대시보드에서 트래픽 확인
5. UptimeRobot 알림을 받았으면 다운 시각을 기록해 클로드한테 진단 요청

### 검색에 안 잡힐 때 (발행 1주 후에도)
1. 서치콘솔 → 페이지(색인 생성) 보고서 확인
2. https://noahgroup.co.kr/robots.txt 에서 차단 여부 확인
3. 사이트맵 제출 상태 재확인
4. `site:noahgroup.co.kr` 검색 결과를 클로드한테 알려주고 진단 요청

### Cloudflare 인증서 경고
- 평소 프록시 ON 상태를 유지하면 자동 갱신됩니다. 프록시를 끄면 갱신이 실패할 수 있습니다.
