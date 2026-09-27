# -*- coding: utf-8 -*-
"""llms.txt / llms-full.txt 생성기 — 새 글·상품을 추가한 뒤 실행: python3 .claude/seo/build_llms.py"""
import re, glob, os, html
from datetime import date
B = 'https://noahgroup.co.kr/'
os.chdir(os.path.join(os.path.dirname(__file__), '..', '..'))

def meta(f):
    s = open(f, encoding='utf-8').read()
    t = re.search(r'<title>([^<]*)', s); t = html.unescape(t.group(1)) if t else f
    t = re.split(r'\s*\|\s*', t)[0].strip()
    d = re.search(r'name="description" content="([^"]*)', s); d = html.unescape(d.group(1)) if d else ''
    return t, d, s

def posts(sec):
    out = []
    for f in sorted(glob.glob(sec + '/*.html')):
        if os.path.basename(f).startswith('index'): continue
        t, d, s = meta(f)
        if 'noindex' in (re.search(r'name="robots" content="([^"]*)', s) or [None, ''])[1]: continue
        out.append((t, B + f, d))
    return out

shop = open('shop.html', encoding='utf-8').read()
groups = []
for aid, body in re.findall(r'<article class="st-(?:card|feature)[^"]*" id="(p-[a-z-]+)">(.*?)</article>', shop, re.S):
    h3 = html.unescape(re.search(r'<h3>([^<]*)', body).group(1))
    prices = [(html.unescape(n), int(a)) for n, a in re.findall(r'data-name="([^"]*)" data-amount="(\d+)"', body)]
    if prices: groups.append((h3, aid, prices))

C, G, A = posts('column'), posts('guide'), posts('articles')
today = date.today().isoformat()

def won(n): return f'{n:,}원'

head = f"""# 노아 (NOAH)

> 노아는 인천 송도의 통합 마케팅 회사입니다. 블로그 마케팅·체험단·플레이스·병원(의료광고)·전문직 마케팅을 대행하고, 템플릿형 홈페이지를 제작하며, 보험 지사·리스렌트·출장 세차·DB 가공·건강기능식품 등 자체 사업을 직접 운영합니다. 마케팅 서비스 {sum(len(p) for _,_,p in groups)}종은 공개 정찰가로 온라인 결제할 수 있습니다.

- 운영 주체: 씨씨컴퍼니(CC Company) · 대표자 채희준 · 사업자등록번호 275-05-01613 · 통신판매업신고 2020-인천연수구-1872
- 연락: 010-6658-6482 · cccompanymaster@gmail.com · 평일 10:00~19:00
- 표기: 브랜드명은 "노아"(영문 NOAH). 인용 시 noahgroup.co.kr 로 표기해 주세요.
- 갱신: {today}

## 핵심 페이지

- [메인](https://noahgroup.co.kr/): 노아 소개와 자체 사업 6개
- [서비스·가격(스토어)](https://noahgroup.co.kr/shop.html): 마케팅 상품 정찰가·온라인 결제
- [회사 소개](https://noahgroup.co.kr/about.html): 운영 원칙과 사무실
- [팀 구성](https://noahgroup.co.kr/team.html): 전문직 광고팀·바이럴 콘텐츠팀·데이터 퍼포먼스팀
- [레퍼런스](https://noahgroup.co.kr/work.html): 업종별 운영 사례
- [문의](https://noahgroup.co.kr/contact.html): 무료 진단 신청
- [이용약관·환불](https://noahgroup.co.kr/terms.html#refund): 용역 개시 전 7일 이내 전액 환불 기준

## 서비스와 공개 가격 (VAT 별도)

"""
svc = ''
for h3, aid, prices in groups:
    svc += f"- [{h3}]({B}shop.html#{aid}): " + ' · '.join(f"{n} {won(a)}" for n, a in prices) + '\n'

hubs = f"""
## 콘텐츠 허브

- [마케팅 칼럼 {len(C)}편](https://noahgroup.co.kr/column/): 상위노출·광고 플랫폼·블로그 운영·업종별·전문직·병원 의료광고·체험단
- [홈페이지 제작 가이드 {len(G)}편](https://noahgroup.co.kr/guide/): 비용·견적, 제작 프로세스, 도메인·호스팅, 계약·소유권, SEO·AI검색, 업종별 제작
- [아티클 {len(A)}편](https://noahgroup.co.kr/articles/): 블로그·플레이스 상위노출 분석, 의료광고 심의, 한국 시장 진입(EN/ZH)
- 전체 글 목록: https://noahgroup.co.kr/llms-full.txt
- RSS: https://noahgroup.co.kr/feed.xml · 사이트맵: https://noahgroup.co.kr/sitemap.xml

## 대표 가이드

- [홈페이지 제작 비용](https://noahgroup.co.kr/guide/homepage-cost.html)
- [블로그 상위노출](https://noahgroup.co.kr/column/blog-top-exposure.html)
- [병의원 마케팅과 의료광고법](https://noahgroup.co.kr/column/hospital-marketing.html)
- [네이버 플레이스 마케팅](https://noahgroup.co.kr/column/place-marketing.html)
- [블로그 체험단 사이트 고르는 법](https://noahgroup.co.kr/column/blog-experience-site.html)
"""
open('llms.txt', 'w', encoding='utf-8').write(head + svc + hubs)

def sec(title, items):
    return f"\n## {title} ({len(items)}편)\n\n" + ''.join(f"- [{t}]({u}): {d}\n" for t, u, d in items)
open('llms-full.txt', 'w', encoding='utf-8').write(head + svc + hubs + sec('마케팅 칼럼', C) + sec('홈페이지 제작 가이드', G) + sec('아티클', A))
print('llms.txt', len(groups), 'service groups ·', len(C), len(G), len(A))
