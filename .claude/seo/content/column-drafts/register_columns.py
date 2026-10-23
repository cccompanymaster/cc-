# 발행 등록 — 목록 카드·편수, 사이트맵, 피드, 인벤토리, 기존 칼럼 역링크. 사용: python3 register_columns.py slug ...
import re, json, html, sys, os, glob, collections
D = os.path.dirname(os.path.abspath(__file__)) + '/'; ROOT = D.split('/.claude/')[0] + '/' if '/.claude/' in D else '/home/user/cc-/'
os.chdir(ROOT)
CAT = {'ad': '광고 플랫폼', 'expo': '상위노출', 'blog': '블로그 운영', 'industry': '업종별 마케팅', 'pro': '전문직 마케팅',
       'medical': '병원·의료', 'job': '블로그 부업', 'viral': '바이럴·에이전시', 'exp': '체험단'}
import datetime
argv = sys.argv[1:]
DATE = argv[argv.index('--date') + 1] if '--date' in argv else datetime.date.today().isoformat()
PUB = datetime.date.fromisoformat(DATE).strftime('%a, %d %b %Y') + ' 09:00:00 +0900'
slugs = [a for i, a in enumerate(argv) if not a.startswith('--') and (i == 0 or argv[i - 1] != '--date')]; specs = [json.load(open(D + f'specs/{s}.json', encoding='utf-8')) for s in slugs]
managed = {os.path.basename(f)[:-5] for f in glob.glob(D + 'rewrite/*.json')}  # 재작성 원고가 있는 기존 칼럼은 원고의 관련 글로 관리
for sp in specs: assert os.path.exists(f'column/{sp["slug"]}.html'), sp['slug']
e = lambda s: html.escape(s, quote=False)
# 1) 목록 카드(최신 글 앞) + 편수
idx = open('column/index.html', encoding='utf-8').read()
new = [sp for sp in specs if f'href="{sp["slug"]}.html"' not in idx]
cards = ''.join(f'<a class="card" href="{sp["slug"]}.html" data-cat="{sp["cat"]}"><span class="cc">#{CAT[sp["cat"]]}</span><h2>{e(sp["title"])}</h2><p>{e(sp["lead"][:88])}…</p></a>\n' for sp in new)
i = idx.index('<a class="card"'); idx = idx[:i] + cards + idx[i:]
total = len(re.findall(r'<a class="card" ', idx))
idx = re.sub(r'\d+편(?=[.\"<])', f'{total}편', idx)
open('column/index.html', 'w', encoding='utf-8').write(idx)
# 2) 사이트맵
sm = open('sitemap-column.xml', encoding='utf-8').read()
urls = ''.join(f'  <url>\n    <loc>https://noahgroup.co.kr/column/{sp["slug"]}.html</loc>\n    <lastmod>{DATE}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n' for sp in new)
sm = re.sub(r'(<loc>https://noahgroup\.co\.kr/column/</loc>\s*<lastmod>)[^<]*', r'\g<1>' + DATE, sm)
open('sitemap-column.xml', 'w', encoding='utf-8').write(sm.replace('</urlset>', urls + '</urlset>'))
x = open('sitemap.xml', encoding='utf-8').read()
open('sitemap.xml', 'w', encoding='utf-8').write(re.sub(r'(<loc>https://noahgroup\.co\.kr/sitemap-column\.xml</loc>\s*<lastmod>)[^<]*', r'\g<1>' + DATE, x))
# 3) 피드 (맨 앞)
items = ''.join(f'''    <item>
      <title>{e(sp["title"])}</title>
      <link>https://noahgroup.co.kr/column/{sp["slug"]}.html</link>
      <guid isPermaLink="true">https://noahgroup.co.kr/column/{sp["slug"]}.html</guid>
      <pubDate>{PUB}</pubDate>
      <description>{e(sp["description"])}</description>
      <dc:creator>노아 편집팀</dc:creator>
    </item>
''' for sp in new)
for fd in ('feed-column.xml', 'feed.xml'):
    s = open(fd, encoding='utf-8').read(); i = s.index('    <item>')
    s = s[:i] + items + s[i:]
    s = re.sub(r'<lastBuildDate>[^<]*</lastBuildDate>', f'<lastBuildDate>{PUB}</lastBuildDate>', s, count=1)
    open(fd, 'w', encoding='utf-8').write(s)
# 4) 인벤토리
p = '.claude/seo/content/inventory.json'; inv = json.load(open(p, encoding='utf-8')); have = {i['url'] for i in inv}
inv += [{'url': f'column/{sp["slug"]}.html', 'title': sp['title'], 'lang': 'ko', 'pub': DATE, 'mod': DATE, 'faq': len(sp['faq'])} for sp in new if f'column/{sp["slug"]}.html' not in have]
open(p, 'w', encoding='utf-8').write(json.dumps(inv, ensure_ascii=False, indent=0) + '\n')
# 5) 역링크 — 같은 분류의 기존 칼럼 중 들어오는 링크가 적은 2곳의 '함께 읽으면 좋은 글'에 추가
pages = {f: open(f, encoding='utf-8').read() for f in glob.glob('column/*.html')}
inbound = collections.Counter()
for f, s in pages.items():
    for h in set(re.findall(r'href="([a-z0-9-]+\.html)"', s)): inbound[h] += 1
catof = {}
for f, s in pages.items():
    m = re.search(r'<span class="cat">#([^<]+)</span>', s)
    if m: catof[f] = m.group(1)
added = 0
for sp in new:
    cands = [f for f in pages if catof.get(f) == CAT[sp['cat']] and f[7:-5] not in slugs and f[7:-5] not in managed and f'href="{sp["slug"]}.html"' not in pages[f]]
    for f in sorted(cands, key=lambda f: inbound[f[7:]])[:2]:
        s = pages[f]; m = re.search(r'(<div class="rel"><h2>함께 읽으면 좋은 글</h2>.*?)(</div>)', s, re.S)
        if not m: continue
        s = s[:m.end(1)] + f'<a href="{sp["slug"]}.html">{e(sp["title"])}</a>' + s[m.end(1):]
        pages[f] = s; open(f, 'w', encoding='utf-8').write(s); inbound[f[7:]] += 0; added += 1
print('등록', len(new), '총 칼럼', total, '역링크', added)
