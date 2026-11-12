# 아티클 차트 정리 (대표님 결정 2026-11-11: A안)

숫자가 들어간 아티클 차트 61개(37편)를 공식 자료로 확인해 다시 그린다.
- 확인된 숫자 → 새 차트 스타일(css/viz.css)로, 출처·기준일 표기
- 확인 안 되는 숫자(요소별 가중치·자체 실측 비율 등) → 숫자 없는 그림(.fx-grid)으로 바꾸거나 차트 삭제
- 본문·한 줄 답·FAQ(화면=LD)·HowTo LD에 같은 숫자가 있으면 함께 고친다
- '노아 자체 데이터' 출처 차트: 원자료가 오면 그 숫자로 다시 그림, 없으면 확인 불가로 처리

charts.json: 차트별 상태(todo / redrawn / converted / removed)와 메모.
근거는 공식 출처로 확인해 다시 쓴 칼럼 원고(column-drafts/rewrite/*.json)의 sources·notes를 먼저 쓴다.

## 도구 (apply_fix.py)
- `apply(...)`: 본문·FAQ(화면=LD)·HowTo LD·참고 자료·설명·검토일·사이트맵·charts.json을 한 번에 고치고, 끝에 `sync_meta`로 피드·llms-full.txt·인벤토리까지 맞춘다
- `swap_all(old, new, only=None)`: 제목·카드 문구를 사이트 전체(공개 html·xml·txt + 인벤토리 + OG 카드 데이터)에서 정확히 같은 문자열만 바꾼다
- `sync_meta(f)`: 제목을 바꾼 뒤 다시 불러 피드·llms·인벤토리를 글의 현재 제목·설명에 맞춘다
- `check(f)`: (화면 FAQ == FAQPage LD, FAQ 수, 그림 수)

## 제목을 바꿔야 할 때
숫자를 지운 뒤 제목이 거짓이 되면(예: '사례집 — ROI·KPI 공개') 제목도 바꾼다. 주소(슬러그)는 그대로 둔다.
1. 글 안: `<title>`·og:title·LD headline·H1·빵부스러기(LD·화면) — `swap_all(옛 제목, 새 제목)`이 대부분 처리
2. 다른 페이지: 아티클 목록 카드(h3·요약·태그·mag-stat), 관련 글 카드(ar-card h3·요약), 작성자 페이지(aa-row), 칼럼 링크 문구
3. 공유 이미지: `.claude/seo/og/cards.json` 제목·kicker 수정 후 `node .claude/seo/og/render.js og/articles/<slug>` (Pretendard 폰트 필요: render.js 첫 주석 참고)
4. 카드 요약에 지운 숫자·틀린 요소(예: '3대 기둥', '5대 요소')가 남아 있지 않은지 `grep`으로 확인
