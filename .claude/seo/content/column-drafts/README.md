# 새 칼럼 원고 50편 (2026-10-22 작성) — 나눠서 발행

- `specs/<slug>.json`: 원고 원본. 화면 HTML과 구조화 데이터(FAQ 포함)를 이 한 파일에서 만든다
- `plan.json`: 대상 검색어·분류·각도 / `first_party.md`: 인용 가능한 노아 수치(공개 가격표) / `prompt.md`: 집필 기준
- 각 원고의 `notes`: 확인 못 한 것, 발행 전에 다시 볼 것

## 발행 순서 (한 묶음씩)
1. `python3 gate.py` — 발행 게이트(분량·질문형 소제목·표 기준일·FAQ·금지어·중복 문장·링크)
2. `python3 build_columns.py slug1 slug2 …` — column/<slug>.html 생성. 아직 발행 안 된 새 글로 가는 링크는 글자만 남는다
3. `python3 register_columns.py slug1 slug2 …` — 목록 카드·편수, sitemap-column·sitemap, feed-column·feed, 인벤토리, 같은 분류 기존 칼럼 2곳에 역링크
4. 이미 발행한 새 글을 다시 빌드해 새로 생긴 글로 가는 링크를 되살린다: `python3 build_columns.py <발행된 전체 slug>`
5. `python3 ../../build_llms.py` 후 커밋·푸시 (IndexNow는 배포 워크플로가 자동 통지)

## 발행 현황
- 1차(2026-10-22): naver-keyword-volume, blog-index, place-review, naver-searchad-cost, hair-salon-marketing, realtor-marketing, ai-blog-writing, experience-cost, marketing-agency-scam, blog-income-tax
- 10/23~10/30 하루 5편씩 나머지 40편 발행 완료 (schedule.json). 의료 5편은 10/30 법령 대조 후 발행 — 약국 글은 2026-08 약사법 개정(약국 명칭 제한 법률화)을 반영해 고침
