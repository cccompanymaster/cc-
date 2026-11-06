/* 자동 생성 파일 — 직접 고치지 마세요.
   원본: apps-script/shop-catalog.json → python3 .claude/build/catalog/build_catalog.py
   서버(apps-script/Nicepay.gs SHOP_CATALOG)와 같은 표에서 나옵니다. 실제 결제 금액은 서버가 다시 계산합니다. */
window.NOAH_CATALOG = Object.freeze({
 "currency": "KRW",
 "vatIncluded": true,
 "maxOrderAmount": 10000000,
 "products": {
  "brand-run": {
   "name": "브랜드 블로그 운영",
   "card": "p-blog-run",
   "svc": "brand-run",
   "unit": "개월",
   "maxQty": 12,
   "kmong": 529705,
   "options": [
    {
     "key": "standard",
     "label": "STANDARD",
     "price": 149000,
     "summary": "콘텐츠 8건 · 1,500자↑ · 지수 육성",
     "detail": "지수 육성형 — 콘텐츠 8건, 원고 1,500자 이상",
     "days": 30,
     "revisions": "1회",
     "minQty": 1,
     "svc": "brand-run"
    },
    {
     "key": "deluxe",
     "label": "DELUXE",
     "price": 299000,
     "summary": "콘텐츠 15건 · 키워드 전략 · 이웃관리",
     "detail": "컨텐츠 특화형 — 콘텐츠 15건, 1,500자 이상, 키워드 전략, 이웃관리 플랜",
     "days": 30,
     "revisions": "1회",
     "minQty": 1,
     "svc": "brand-run"
    },
    {
     "key": "premium",
     "label": "PREMIUM",
     "price": 499000,
     "summary": "콘텐츠 30+1건 · 2,000자↑ · 노출 리포트",
     "detail": "노출 최적화형 — 콘텐츠 30+1건, 2,000자 이상, 키워드 전략, 전용 노출 보고 시트, 이웃관리 플랜",
     "days": 30,
     "revisions": "1회",
     "minQty": 1,
     "svc": "brand-run"
    }
   ],
   "extras": [
    {
     "key": "skin",
     "label": "블로그 디자인 (위젯 없이)",
     "detail": "블로그 디자인 스킨 제작·제공",
     "price": 50000
    },
    {
     "key": "home-skin",
     "label": "홈페이지형 블로그 디자인",
     "detail": "홈페이지 형식 블로그 디자인 + 위젯 3개",
     "price": 150000
    },
    {
     "key": "thumb",
     "label": "콘텐츠 썸네일 제작",
     "detail": "콘텐츠에 쓰는 썸네일 제작",
     "price": 10000
    },
    {
     "key": "cardnews",
     "label": "카드뉴스 제작",
     "detail": "카드뉴스 1세트 (5장 내외)",
     "price": 20000
    }
   ]
  },
  "blog-dist": {
   "name": "블로그 배포",
   "card": "p-blog-post",
   "svc": "blog-dist",
   "unit": "건",
   "maxQty": 100,
   "kmong": 522065,
   "options": [
    {
     "key": "standard",
     "label": "준최적",
     "price": 11000,
     "summary": "준최적화 블로그 · 상호명·저경쟁 키워드",
     "detail": "준최적화 블로그 포스팅 배포 — 검색량 적은 키워드, 대용량 발행에 적합",
     "days": 2,
     "revisions": "1회",
     "minQty": 1,
     "svc": "blog-dist"
    },
    {
     "key": "deluxe",
     "label": "고지수 준최적",
     "price": 22000,
     "summary": "지수 높은 준최적화 블로그",
     "detail": "고품질 준최적화 블로그 배포 — 준최적 중 지수가 높은 블로그",
     "days": 2,
     "revisions": "1회",
     "minQty": 1,
     "svc": "blog-dist"
    },
    {
     "key": "premium",
     "label": "최적",
     "price": 38000,
     "summary": "최적화 블로그 · 경쟁 키워드",
     "detail": "최적화 블로그 포스팅 배포 — 키워드에 따라 상담 권장",
     "days": 2,
     "revisions": "1회",
     "minQty": 1,
     "svc": "blog-dist"
    }
   ],
   "extras": [
    {
     "key": "fast",
     "label": "빠른 작업",
     "detail": "작업일 1일",
     "price": 10000
    }
   ]
  },
  "rank": {
   "name": "블로그 상위노출 보장",
   "card": "p-blog-rank",
   "svc": "rank-25d",
   "unit": "키워드",
   "maxQty": 20,
   "kmong": 522037,
   "options": [
    {
     "key": "standard",
     "label": "24시간",
     "price": 49000,
     "summary": "24시간 최적화 노출 관리",
     "detail": "최적화 노출 관리 24시간 · A/S 1일",
     "days": 1,
     "revisions": "1회",
     "minQty": 1,
     "svc": "rank-24h"
    },
    {
     "key": "deluxe",
     "label": "25일 프리미엄",
     "price": 198000,
     "summary": "25일 프리미엄 노출 관리",
     "detail": "프리미엄 노출 관리 25일 · A/S 25일",
     "days": 25,
     "revisions": "1회",
     "minQty": 1,
     "svc": "rank-25d"
    },
    {
     "key": "premium",
     "label": "25일 도배형",
     "price": 999000,
     "summary": "25일 도배형 노출 관리",
     "detail": "도배형 노출 관리 25일 · A/S 25일",
     "days": 25,
     "revisions": "1회",
     "minQty": 1,
     "svc": "rank-25d"
    }
   ],
   "extras": []
  },
  "influencer": {
   "name": "공식 인플루언서 블로그 배포",
   "card": "p-blog-influencer",
   "svc": "influencer",
   "unit": "건",
   "maxQty": 50,
   "kmong": 802436,
   "options": [
    {
     "key": "standard",
     "label": "준최적",
     "price": 77000,
     "summary": "준최적 인플루언서 블로그 발행",
     "detail": "준최적 인플루언서 콘텐츠 배포 (N 공식 인플루언서)",
     "days": 2,
     "revisions": "1회",
     "minQty": 1,
     "svc": "influencer"
    },
    {
     "key": "deluxe",
     "label": "고품질 준최적",
     "price": 165000,
     "summary": "고품질 준최적 인플루언서 발행",
     "detail": "고품질 준최적 인플루언서 콘텐츠 배포",
     "days": 2,
     "revisions": "1회",
     "minQty": 1,
     "svc": "influencer"
    },
    {
     "key": "premium",
     "label": "최적화",
     "price": 220000,
     "summary": "최적화 인플루언서 블로그 발행",
     "detail": "최적화 인플루언서 콘텐츠 배포",
     "days": 2,
     "revisions": "1회",
     "minQty": 1,
     "svc": "influencer"
    }
   ],
   "extras": []
  },
  "neighbor": {
   "name": "블로그 이웃 늘리기",
   "card": "p-blog-neighbor",
   "svc": "neighbor",
   "unit": "회",
   "maxQty": 10,
   "kmong": 523116,
   "options": [
    {
     "key": "standard",
     "label": "STANDARD",
     "price": 20000,
     "summary": "소규모 · 공감/소통 · A/S 10일",
     "detail": "이웃 관리 소규모 · 공감·소통 포함 · A/S 10일",
     "days": 10,
     "revisions": "제한없음",
     "minQty": 1,
     "svc": "neighbor"
    },
    {
     "key": "deluxe",
     "label": "DELUXE",
     "price": 50000,
     "summary": "중규모 · 공감/소통 · A/S 30일",
     "detail": "이웃 관리 중규모 · 공감·소통 포함 · A/S 30일",
     "days": 30,
     "revisions": "제한없음",
     "minQty": 1,
     "svc": "neighbor"
    },
    {
     "key": "premium",
     "label": "PREMIUM",
     "price": 100000,
     "summary": "대규모 · 공감/소통 · A/S 30일",
     "detail": "이웃 관리 대규모 · 공감·소통 포함 · A/S 30일",
     "days": 30,
     "revisions": "제한없음",
     "minQty": 1,
     "svc": "neighbor"
    }
   ],
   "extras": []
  },
  "write": {
   "name": "블로그용 원고 작성",
   "card": "p-blog-write",
   "svc": "write",
   "unit": "건",
   "maxQty": 100,
   "kmong": 519256,
   "options": [
    {
     "key": "standard",
     "label": "STANDARD",
     "price": 8000,
     "summary": "1,000자 이하 1건 · 키워드 분석",
     "detail": "공백 미포함 1,000자 이하 1건 · 키워드 분석 · 정보성/후기성",
     "days": 2,
     "revisions": "1회",
     "minQty": 1,
     "svc": "write"
    },
    {
     "key": "deluxe",
     "label": "DELUXE",
     "price": 12000,
     "summary": "1,500자 이하 1건 · 키워드 분석",
     "detail": "공백 미포함 1,500자 이하 1건 · 키워드 분석 · 정보성/후기성",
     "days": 2,
     "revisions": "1회",
     "minQty": 1,
     "svc": "write"
    },
    {
     "key": "premium",
     "label": "PREMIUM",
     "price": 15000,
     "summary": "2,000자 이하 1건 · 키워드 분석",
     "detail": "공백 미포함 2,000자 이하 1건 · 키워드 분석 · 정보성/후기성",
     "days": 2,
     "revisions": "1회",
     "minQty": 1,
     "svc": "write"
    }
   ],
   "extras": [
    {
     "key": "fast",
     "label": "빠른 작업",
     "detail": "작업일 1일",
     "price": 1000
    }
   ]
  },
  "cafe": {
   "name": "카페 게시글 배포",
   "card": "p-cafe",
   "svc": "cafe",
   "unit": "건",
   "maxQty": 100,
   "kmong": 848186,
   "options": [
    {
     "key": "standard",
     "label": "대량 배포",
     "price": 11000,
     "summary": "인지도·콘텐츠 쌓기용 · 10건부터",
     "detail": "수량형 대량 카페 배포 (10건 이상) · 발행 후 24시간 내 누락 시 A/S",
     "days": 2,
     "revisions": "0회",
     "minQty": 10,
     "svc": "cafe"
    },
    {
     "key": "deluxe",
     "label": "카테고리 맞춤",
     "price": 22000,
     "summary": "업종 맞춤 카페 · 발행 전 리스트 확인",
     "detail": "카테고리 적합 카페 배포 · 발행 전 리스트 컨펌 · 24시간 내 누락 시 A/S",
     "days": 2,
     "revisions": "0회",
     "minQty": 1,
     "svc": "cafe"
    },
    {
     "key": "premium",
     "label": "노출 최적화",
     "price": 44000,
     "summary": "카테고리별 노출 최적화 카페",
     "detail": "카테고리별 노출 최적화 카페 배포 · 발행 전 리스트 컨펌 · 24시간 내 누락 시 A/S",
     "days": 2,
     "revisions": "0회",
     "minQty": 1,
     "svc": "cafe"
    }
   ],
   "extras": []
  },
  "exp": {
   "name": "블로그 체험단",
   "card": "p-exp",
   "svc": "exp",
   "unit": "회",
   "maxQty": 20,
   "kmong": 760636,
   "options": [
    {
     "key": "standard",
     "label": "배송형",
     "price": 16000,
     "summary": "준최4↑ 블로거 10건 규모",
     "detail": "배송형 체험단 — 준최4 이상 10건 (1건당 1,590원)",
     "days": 14,
     "revisions": "1회",
     "minQty": 1,
     "svc": "exp"
    },
    {
     "key": "deluxe",
     "label": "방문형",
     "price": 45000,
     "summary": "준최4↑ 방문 체험 · 5건↑ 할인",
     "detail": "방문형 체험단 — 준최4 이상 (1건 10,000원, 5건 이상 건별 8,900원)",
     "days": 14,
     "revisions": "1회",
     "minQty": 1,
     "svc": "exp"
    },
    {
     "key": "premium",
     "label": "프리미엄",
     "price": 55000,
     "summary": "최적화 5건~ · 인플루언서 15건~",
     "detail": "인플루언서/최적화 체험단 — 최적화 5건~, 인플루언서 15건~",
     "days": 14,
     "revisions": "1회",
     "minQty": 1,
     "svc": "exp"
    }
   ],
   "extras": []
  },
  "daangn-ad": {
   "name": "당근마켓 광고대행",
   "card": "p-danggeun",
   "svc": "daangn-ad",
   "unit": "개월",
   "maxQty": 12,
   "kmong": 523117,
   "options": [
    {
     "key": "single",
     "label": "단일 상품",
     "price": 100000,
     "summary": "광고 세팅 + 운영 대행 + 컨설팅 + 월 보고서",
     "detail": "유선 컨설팅 + 광고 세팅·운영 + 월 관리 보고서",
     "days": 5,
     "revisions": "2회",
     "minQty": 1,
     "svc": "daangn-ad"
    }
   ],
   "extras": []
  },
  "homepage": {
   "name": "템플릿형 홈페이지 제작",
   "card": "p-homepage",
   "svc": "homepage",
   "unit": "개",
   "maxQty": 1,
   "kmong": 772455,
   "options": [
    {
     "key": "single",
     "label": "단일 상품",
     "price": 199000,
     "summary": "제작 일체(위 포함 항목 전체) · 시안 2개",
     "detail": "퀄리티형 홈페이지 · 시안 2개 · 상업적 이용 가능",
     "days": 7,
     "revisions": "5회",
     "minQty": 1,
     "svc": "homepage"
    }
   ],
   "extras": []
  }
 }
});
