# 사이트 점검 — 끊긴 내부 링크, JSON-LD 파싱 오류, 한 페이지에 FAQPage 여러 개, (선택) 칼럼 FAQ 화면 = FAQPage LD
# 사용: python3 check_site.py [칼럼slug ...]   — slug를 주면 그 칼럼의 FAQ 화면과 LD가 글자까지 같은지도 본다
import os, re, json, html, sys
D = os.path.dirname(os.path.abspath(__file__)) + '/'
ROOT = D.split('/.claude/')[0]
os.chdir(ROOT)
pages = []
for d, ds, fs in os.walk('.'):
    ds[:] = [x for x in ds if x not in ('.git', 'node_modules', '.claude')]
    pages += [os.path.join(d, f) for f in fs if f.endswith('.html')]
broken, badld, multi = [], [], []
def walk(o):
    if isinstance(o, dict):
        yield o
        for v in o.values(): yield from walk(v)
    elif isinstance(o, list):
        for v in o: yield from walk(v)
for p in sorted(pages):
    t = open(p, encoding='utf-8', errors='replace').read()
    for u in re.findall(r'''(?:href|src)=["']([^"']*)["']''', t):
        u = html.unescape(u).split('#')[0].split('?')[0]
        if not u or re.match(r'^(https?:|//|mailto:|tel:|sms:|javascript:|data:|blob:)', u): continue
        f = '.' + u if u.startswith('/') else os.path.normpath(os.path.join(os.path.dirname(p), u))
        if u.endswith('/') or os.path.isdir(f): f = os.path.join(f, 'index.html')
        if not (os.path.exists(f) or os.path.exists(f + '.html')): broken.append((p, u))
    n = 0
    for s in re.findall(r'<script type="application/ld\+json">(.*?)</script>', t, re.S):
        try: n += sum(1 for x in walk(json.loads(s)) if x.get('@type') == 'FAQPage')
        except Exception as e: badld.append((p, str(e)[:60]))
    if n > 1: multi.append(p)
print('pages', len(pages))
print('broken links', len(broken), broken[:12])
print('bad LD', badld)
print('multi FAQPage', multi)
norm = lambda s: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', s))).strip()
faq_bad = []
for slug in sys.argv[1:]:
    t = open(f'column/{slug}.html', encoding='utf-8').read()
    ld = []
    for s in re.findall(r'<script type="application/ld\+json">(.*?)</script>', t, re.S):
        for x in walk(json.loads(s)):
            if x.get('@type') == 'FAQPage':
                ld = [(norm(q['name']), norm(q['acceptedAnswer']['text'])) for q in x['mainEntity']]
    vis = [(norm(q), norm(a)) for q, a in re.findall(r'<details><summary>(.*?)</summary><div class="fb">(.*?)</div></details>', t, re.S)]
    ok = bool(ld) and ld == vis
    print(slug, 'FAQ 화면=LD', ok, len(vis))
    if not ok: faq_bad.append(slug)
if broken or badld or multi or faq_bad: sys.exit(1)
