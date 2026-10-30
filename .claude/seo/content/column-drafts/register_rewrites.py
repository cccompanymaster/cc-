# 재작성 발행 등록 — 목록 카드 문구, 사이트맵 날짜, 피드 제목·설명, 인벤토리, 다른 페이지의 링크 문구(옛 제목 → 새 제목)
# 사용: python3 register_rewrites.py --date YYYY-MM-DD --old old_titles.json slug ...
import re, json, html, sys, os, glob
D = os.path.dirname(os.path.abspath(__file__)) + '/'; ROOT = D.split('/.claude/')[0] + '/'
os.chdir(ROOT)
argv = sys.argv[1:]
DATE = argv[argv.index('--date') + 1]
old = json.load(open(argv[argv.index('--old') + 1], encoding='utf-8'))   # slug → [옛 제목 변형들]
slugs = [a for i, a in enumerate(argv) if not a.startswith('--') and argv[i - 1] not in ('--date', '--old')]
e = lambda s: html.escape(s, quote=False)
specs = {s: json.load(open(D + f'rewrite/{s}.json', encoding='utf-8')) for s in slugs}
# 1) 목록 카드: 제목·요약만 교체
idx = open('column/index.html', encoding='utf-8').read()
for s, sp in specs.items():
    idx, k = re.subn(r'(<a class="card" href="' + re.escape(s) + r'\.html" data-cat="[^"]+"><span class="cc">[^<]*</span><h2>)[^<]*(</h2><p>)[^<]*(</p></a>)',
                     lambda m: m.group(1) + e(sp['title']) + m.group(2) + e(sp['lead'][:88]) + '…' + m.group(3), idx)
    assert k == 1, ('card', s, k)
open('column/index.html', 'w', encoding='utf-8').write(idx)
# 2) 사이트맵 날짜
sm = open('sitemap-column.xml', encoding='utf-8').read()
for s in slugs:
    sm, k = re.subn(r'(<loc>https://noahgroup\.co\.kr/column/' + re.escape(s) + r'\.html</loc>\s*<lastmod>)[^<]*', r'\g<1>' + DATE, sm); assert k == 1, ('sitemap', s)
sm = re.sub(r'(<loc>https://noahgroup\.co\.kr/column/</loc>\s*<lastmod>)[^<]*', r'\g<1>' + DATE, sm)
open('sitemap-column.xml', 'w', encoding='utf-8').write(sm)
x = open('sitemap.xml', encoding='utf-8').read()
open('sitemap.xml', 'w', encoding='utf-8').write(re.sub(r'(<loc>https://noahgroup\.co\.kr/sitemap-column\.xml</loc>\s*<lastmod>)[^<]*', r'\g<1>' + DATE, x))
# 3) 피드: 해당 글 항목의 제목·설명
for fd in ('feed-column.xml', 'feed.xml'):
    s0 = open(fd, encoding='utf-8').read()
    def fix(m):
        it = m.group(0); l = re.search(r'<link>https://noahgroup\.co\.kr/column/([a-z0-9-]+)\.html</link>', it)
        if not l or l.group(1) not in specs: return it
        sp = specs[l.group(1)]
        it = re.sub(r'<title>.*?</title>', lambda _: '<title>' + e(sp['title']) + '</title>', it, count=1, flags=re.S)
        return re.sub(r'<description>.*?</description>', lambda _: '<description>' + e(sp['description']) + '</description>', it, count=1, flags=re.S)
    open(fd, 'w', encoding='utf-8').write(re.sub(r'<item>.*?</item>', fix, s0, flags=re.S))
# 4) 인벤토리
p = '.claude/seo/content/inventory.json'; inv = json.load(open(p, encoding='utf-8'))
for i in inv:
    s = i['url'][7:-5] if i['url'].startswith('column/') else None
    if s in specs: i['title'], i['mod'], i['faq'] = specs[s]['title'], DATE, len(specs[s]['faq'])
open(p, 'w', encoding='utf-8').write(json.dumps(inv, ensure_ascii=False, indent=0) + '\n')
# 5) 다른 페이지의 링크 문구: 옛 제목 그대로 걸린 링크만 새 제목으로 (생성기가 만드는 페이지는 다시 빌드할 때 바뀜)
n = 0
for f in glob.glob('**/*.html', recursive=True):
    if f.startswith(('templates/', '.claude/')): continue
    s0 = open(f, encoding='utf-8').read(); s1 = s0
    for s, sp in specs.items():
        for ot in old.get(s, []):
            pat = r'(<a href="(?:\.\./column/|column/|/column/)?' + re.escape(s) + r'\.html"[^>]*>)' + re.escape(e(ot)) + '(</a>)'
            s1, k = re.subn(pat, lambda m: m.group(1) + e(sp['title']) + m.group(2), s1); n += k
    if s1 != s0: open(f, 'w', encoding='utf-8').write(s1)
print('재작성 등록', len(slugs), '· 링크 문구 교체', n)
