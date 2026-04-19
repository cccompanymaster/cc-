# 키워드 타겟팅 플레이북 (Noah Marketing Group)

> **이 문서는 특정 키워드를 네이버·구글에 노출시키고 싶을 때 사용하는 반복 가능한 6단계 실행 매뉴얼입니다.**
> 현재 메인 타겟: `광고대행사`, `네이버 대행사`, `네이버광고대행사`
> 새 키워드로 바꿀 때도 동일한 6단계를 그대로 적용하세요.

---

## 한눈에 보는 6단계 프로세스

```
[1] 키워드 선정  →  [2] 경쟁도 분석  →  [3] 페이지 설계  →  [4] 온페이지 SEO  →  [5] 외부 신호  →  [6] 측정·재최적화
       ↑                                                                                     ↓
       └──────────────────────── 4~8주 주기 반복 ────────────────────────────────────────────┘
```

---

## 1단계 · 키워드 선정

### 1-1. 메인/서브/롱테일 3계층으로 구조화

| 계층 | 역할 | 예시 |
|---|---|---|
| **메인** (Pillar) | 브랜드 포지셔닝. 월 검색량 10,000+ | `광고대행사`, `네이버광고대행사` |
| **서브** (Cluster) | 구매 의도 전환. 1,000~10,000 | `병원 광고대행사`, `법률 광고대행사`, `파워링크 대행사` |
| **롱테일** (Long-tail) | 즉시 전환. 100~1,000 | `강남 피부과 광고대행사`, `변호사 네이버광고 비용` |

### 1-2. 리서치 도구
- **네이버 키워드도구** (searchad.naver.com) → 월 검색량·경쟁도 확인 (한국어 SEO의 1순위 도구)
- **Google Keyword Planner** → 구글 검색량 교차 확인
- **Ahrefs / Semrush** → 경쟁사가 랭킹하는 키워드 역추출
- **네이버 자동완성 + 연관검색어** → 실제 사용자가 타이핑하는 변형
- **ChatGPT/Claude로 의도 확장**: "[메인키워드] 검색자가 추가로 궁금해할 10가지를 알려줘"

### 1-3. 키워드 시트 템플릿
```
| 키워드 | 월 검색량 | 경쟁도 | 검색 의도 | 타겟 페이지 | 우선순위 |
|---|---|---|---|---|---|
| 네이버광고대행사 | 4,800 | 높음 | 정보+상업 | /#faq | ★★★ |
| 병원 광고대행사 | 1,900 | 중간 | 상업 | /products.html | ★★☆ |
| 파워링크 단가 | 720 | 낮음 | 정보 | /blog/powerlink-cost | ★★☆ |
```

---

## 2단계 · 경쟁도 분석 (SERP 역공학)

**네이버와 구글 상위 10개를 각각 저장**하고 아래 체크리스트로 분해한다.

- [ ] 제목 태그 길이·키워드 위치 (앞쪽일수록 유리)
- [ ] 본문 분량 (네이버는 1,500자 이상, 구글은 2,000단어 이상 유리)
- [ ] 이미지·영상·표·체크리스트 개수
- [ ] 내부 링크 수 / 외부 링크 수
- [ ] FAQ 섹션 여부
- [ ] 구조화 데이터 (Schema) 유형
- [ ] 페이지 로드 속도 (Core Web Vitals)
- [ ] 도메인 권한 (DR/UR — Ahrefs)
- [ ] 네이버 뷰 탭 / 카페 / 지식iN / 블로그 노출 분포

**결론 공식**: "상위 10개가 평균 X개 항목을 갖추면, 우리는 X+2개를 갖춘다."

---

## 3단계 · 페이지 설계 (URL 전략)

### 3-1. 1 키워드 = 1 랜딩 페이지 원칙
- 메인 키워드 → 홈 (`/`) 또는 핵심 카테고리 페이지
- 서브 키워드 → 서비스 페이지 (`/products.html`, 향후 `/services/hospital/`)
- 롱테일 키워드 → 블로그/인사이트 글 (`/insights/네이버광고-단가`)

### 3-2. URL 네이밍
```
좋은 예: /insights/naver-powerlink-guide
나쁜 예: /insights?id=42
```
- 영문 슬러그 + 하이픈 구분 (한글 URL은 공유 시 인코딩되어 불리)
- 2~4단어, 키워드 포함

### 3-3. 정보 구조 (IA)
```
Home (/)
├─ /products.html             (전체 상품 목록 · 서브 키워드 Hub)
├─ /services/hospital/        (업종별 랜딩)
├─ /services/legal/
├─ /services/naver-ads/
├─ /insights/                 (블로그 Hub)
│  ├─ /insights/naver-ads-cost
│  ├─ /insights/powerlink-guide
│  └─ /insights/medical-ad-law
├─ /case-studies/             (사례 Hub)
└─ /faq.html                  (FAQ Hub)
```

---

## 4단계 · 온페이지 SEO 체크리스트 ⭐ 핵심

이 노아 사이트에 이미 적용된 패턴을 그대로 복제하세요.

### 4-1. 메타 태그 (최우선)
```html
<title>타겟키워드 · 서브키워드 | 브랜드명</title>          <!-- 50~60자 -->
<meta name="description" content="타겟키워드를 포함한 2문장. 150~160자. CTA 포함.">
<meta name="keywords" content="메인, 서브, 롱테일 5~15개">
<link rel="canonical" href="...">
<link rel="alternate" hreflang="ko" href="...">
```

### 4-2. 오픈그래프 (SNS 공유 시 CTR · 카카오/네이버 공유 필수)
```html
<meta property="og:type" content="website|article">
<meta property="og:title" content="타겟키워드 포함">
<meta property="og:description" content="...">
<meta property="og:image" content="1200x630 이미지">
<meta property="og:url" content="...">
<meta property="og:locale" content="ko_KR">
```

### 4-3. 헤딩 위계
```
<h1> — 페이지당 1개. 메인 키워드 정확히 1회 포함
<h2> — 서브 키워드를 자연스럽게 포함. 3~6개
<h3> — 롱테일 키워드 또는 질문형
```
> 절대 SEO를 위해 어색한 한국어를 쓰지 말 것. "광고대행사" 같은 단어는 한 번만 자연스럽게 넣어도 충분.

### 4-4. 본문 키워드 밀도
- **메인 키워드**: 1~2% (2,000자 본문 기준 20~40회 등장 금지. 5~8회면 충분)
- **관련어·동의어**: 네이버광고, 네이버 대행사, 검색광고, 파워링크 — 자연스럽게 섞기 (TF-IDF 관점)
- **구조**: 첫 100자 안에 메인 키워드 1회 + 마지막 문단에 1회

### 4-5. 구조화 데이터 (JSON-LD)
이미 이 사이트에 적용된 스키마:
- `Organization` + `AdvertisingAgency` + `LocalBusiness` (홈)
- `Service` (6개 상품 스키마)
- `FAQPage` (8개 질문)
- `BreadcrumbList` + `ItemList` (상품 페이지)

**새 페이지 유형별 필수 스키마**:
| 페이지 | 스키마 |
|---|---|
| 블로그/인사이트 글 | `BlogPosting` 또는 `Article` |
| 사례 페이지 | `CaseStudy` or `Article` + `Review` |
| FAQ | `FAQPage` |
| How-to 가이드 | `HowTo` |
| 상품 상세 | `Service` + `Offer` |

### 4-6. 내부 링크
- 각 메인 키워드 페이지는 **관련 서브 키워드 페이지 3~5개에 링크**
- 앵커 텍스트에 키워드 자연스럽게 삽입: "자세한 [네이버광고대행사 비용 구조]는 FAQ를 참고" 식
- 홈 → 핵심 서비스 페이지는 한 번 클릭으로 도달 (클릭 깊이 2 이하)

### 4-7. 이미지 SEO
```html
<img src="naver-powerlink-dashboard.webp"
     alt="네이버 파워링크 대시보드 설정 화면"
     width="1200" height="630"
     loading="lazy"
     decoding="async">
```
- 파일명에 키워드
- alt 텍스트에 키워드 자연스럽게
- WebP/AVIF 포맷 + 명시적 width/height (CLS 방지)

### 4-8. Core Web Vitals (랭킹 요소)
- **LCP < 2.5초** · **CLS < 0.1** · **INP < 200ms**
- PageSpeed Insights 90+ 목표
- 이 사이트에 이미 적용된 최적화: preconnect, lazy Swiper, rAF-throttled scroll, content-visibility, 애니메이션 visibility 기반 pause

---

## 5단계 · 외부 신호 (Off-page)

### 5-1. 사이트맵·검색엔진 등록
- **네이버 서치어드바이저** (searchadvisor.naver.com) → 사이트 등록 + `sitemap.xml` 제출 + RSS 제출
- **Google Search Console** → property 등록 + `sitemap.xml`
- **Bing Webmaster** (한국 점유율은 낮지만 AI 검색 Copilot 소스로 중요)
- 결과 확인 주기: 2주 단위로 색인율·노출 키워드 리포트 체크

### 5-2. 네이버 전용 신호 (한국 SEO의 반 이상)
- **네이버 블로그** (blog.naver.com/{brand}) — 주 2~3회 포스팅, 본문에서 메인 사이트 링크
- **네이버 포스트**·**네이버 TV** — 동영상 콘텐츠 교차 노출
- **네이버 지식iN 전문가 답변** — 브랜드 신뢰도
- **네이버 카페** 업종별 참여 (맘카페·의료·법률)
- **네이버 플레이스** — 사업장 등록 + 후기 관리 (로컬 SEO)

### 5-3. 백링크 전략
- **업종 디렉토리**: 광고대행사 협회, 한국광고주협회, 네이버 공식대행사 페이지
- **미디어 PR**: 수상·기고·칼럼 → 언론사 기사 (IT·마케팅 매체)
- **파트너 링크**: 협업 브랜드, 클라이언트 사례 페이지에서 백링크
- **품질 > 수량**: 도메인 권한 높은 1개 링크 > 무관한 10개

### 5-4. 카카오·SNS
- 카카오채널 + 카카오 비즈보드 광고 → 직접 트래픽
- 인스타그램·유튜브 — 브랜드 검색량 증가 → 네이버 "브랜드 연관 키워드" 상승

---

## 6단계 · 측정·재최적화 (4~8주 주기)

### 6-1. 핵심 KPI
| 지표 | 목표 | 측정 도구 |
|---|---|---|
| 타겟 키워드 순위 | 4주 내 20위, 8주 내 10위 | 네이버 검색 수동 체크, Ahrefs |
| 유기 트래픽 | 월 +15% | GA4, Naver Analytics |
| CTR (검색 → 클릭) | 평균 3% 이상 | Google Search Console |
| 체류 시간 | 60초+ | GA4 engagement time |
| 전환율 | 2~5% | GA4 + 전화 콜트래킹 |

### 6-2. 재최적화 체크리스트 (매 4주)
- [ ] 타겟 키워드 순위 변동 점검
- [ ] 신규 경쟁사 SERP 등장 여부
- [ ] 클릭률 낮은 페이지 → 제목·설명 A/B
- [ ] 체류 시간 낮은 페이지 → 콘텐츠 보강
- [ ] 404·리다이렉트 체인 체크
- [ ] 새로 뜬 연관 키워드 반영 (트렌드 대응)

---

## 새 키워드 적용 예시 — 45분 만에 끝내기

> 예: "피부과 광고대행사" 키워드를 노출시키고 싶다

1. **15분 · 선정**: 네이버 키워드도구 → 검색량 2,400 / 경쟁도 중간 확인. 연관어 "피부과 네이버광고", "피부과 블로그 마케팅", "피부과 바이럴" 추가 수집.
2. **10분 · SERP**: 네이버/구글 상위 10개 훑기. 공통 요소: FAQ + 사례 3~5개 + 가격 언급.
3. **5분 · 페이지**: `/services/dermatology/` 또는 `/insights/dermatology-marketing-guide` 신규 URL 계획.
4. **10분 · 온페이지**: title/description/H1/H2 기본 세팅 + FAQPage 스키마 + Service 스키마.
5. **5분 · 외부**: 네이버 서치어드바이저에 URL 수동 크롤 요청 + 네이버 블로그에서 해당 페이지로 앵커 텍스트 "피부과 광고대행사" 백링크.
6. **4주 후**: 순위 체크 → 2차 보강.

> 단가·사례·업종 변형이 대규모라면 이 플레이북을 여러 번 병렬 실행하되, **1스프린트에 키워드 3~5개까지**만 — 그 이상은 품질이 떨어집니다.

---

## 부록 · 이 사이트에 이미 설치된 SEO 자산 (2026.04 기준)

| 자산 | 위치 | 비고 |
|---|---|---|
| `sitemap.xml` | `/sitemap.xml` | 네이버·구글 서치 등록 시 제출 |
| `robots.txt` | `/robots.txt` | Yeti/NaverBot/Googlebot 모두 허용 |
| `Organization`+`AdvertisingAgency`+`LocalBusiness` | `index.html` `<head>` | 사업자등록번호 보강 가능 |
| `Service` ×6 | `index.html` `<head>` | 서비스별 세부 페이지 만들면 각각 이관 |
| `FAQPage` (8Q) | `index.html` `<head>` + `#faq` 섹션 | Q&A 추가 시 두 곳 모두 업데이트 |
| `BreadcrumbList`+`ItemList` | `products.html` `<head>` | 신규 페이지마다 Breadcrumb 필수 |
| hreflang ko + canonical | 양쪽 페이지 | 다국어 확장 시 en-US 추가 |
| og/twitter | 양쪽 페이지 | og-image.png 실제 1200x630 업로드 필요 |

**다음 할 일 (권장):**
1. `og-image.png` 1200×630 실제 이미지 업로드
2. `/insights/` 정적 글 HTML 페이지 3~5개 발행 (현재 기사는 JS 모달 내부 → 크롤 불리)
3. 네이버 서치어드바이저 사이트 등록 + 사이트맵 제출
4. 사업자등록번호·대표자·통신판매업 번호 footer에 노출 (로컬 SEO + 법적 의무)
5. Naver 공식대행사 뱃지 취득 시 hero 섹션에 visible 뱃지 추가
