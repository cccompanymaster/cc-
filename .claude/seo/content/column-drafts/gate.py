# 발행 게이트 — specs와 생성된 HTML 검사
import re, json, html, glob, sys, os, collections
D = os.path.dirname(os.path.abspath(__file__)) + '/'; ROOT = D.split('/.claude/')[0] + '/' if '/.claude/' in D else '/home/user/cc-/'
BAN = ['최고', '1위', '무조건', '100%', '보장']
def text(h): return html.unescape(re.sub(r'<[^>]+>', '', h))
def sentences(t): return [x.strip() for x in re.split(r'(?<=[.?!다요])\s+', t) if len(x.strip()) >= 40]
specs = {os.path.basename(f)[:-5]: json.load(open(f, encoding='utf-8')) for f in sorted(glob.glob(D + 'specs/*.json'))}
# 기존 칼럼 문장 (중복 검사용)
old = collections.Counter()
for f in glob.glob(ROOT + 'column/*.html'):
    if os.path.basename(f)[:-5] in specs or f.endswith('index.html'): continue
    s = open(f, encoding='utf-8').read(); b = s[s.find('<article'):s.find('</article>')]
    for x in sentences(text(b)): old[x] += 1
seen = collections.defaultdict(set); probs = collections.defaultdict(list)
for slug, sp in specs.items():
    P = probs[slug]
    body = ' '.join(text(s['html']) for s in sp['sections'])
    n = len(body)
    if not 2300 <= n <= 4600: P.append(f'본문 {n}자')
    if not 4 <= len(sp['sections']) <= 6: P.append(f'섹션 {len(sp["sections"])}')
    q = sum(s['h2'].strip().endswith('?') for s in sp['sections'])
    if q < 3: P.append(f'질문형 h2 {q}')
    if len(sp['faq']) != 3: P.append('FAQ 수')
    if not re.search(r'20\d\d', sp['table']['caption']): P.append('표 기준일 없음')
    if len(sp['title']) > 38: P.append(f'제목 {len(sp["title"])}자')
    if not 70 <= len(sp['description']) <= 135: P.append(f'설명 {len(sp["description"])}자')
    kw = sp['keyword'].replace(' ', '')
    if kw not in sp['title'].replace(' ', ''): P.append('제목에 키워드 없음')
    if kw not in (sp['h1_main'] + sp['h1_sub']).replace(' ', ''): P.append('h1에 키워드 없음')
    if kw not in sp['lead'].replace(' ', '')[:80] and kw not in sp['description'].replace(' ', '')[:40]: P.append('직답·설명 앞부분에 키워드 없음')
    alltext = ' '.join([sp['title'], sp['description'], sp['lead'], body, sp['noah']] + [f['q'] + f['a'] for f in sp['faq']] + sp['checklist']['items'])
    for w in BAN:
        if w in alltext: P.append(f'금지어 {w}')
    for x in sentences(body + ' ' + sp['lead']):
        seen[x].add(slug)
        if old[x]: P.append('기존 칼럼과 같은 문장: ' + x[:30])
    for r in sp['related']:
        if not os.path.exists(os.path.normpath(ROOT + 'column/' + r)) and r[:-5] not in specs: P.append('없는 관련 글 ' + r)
for x, ss in seen.items():
    if len(ss) > 1:
        for s in ss: probs[s].append('다른 새 글과 같은 문장: ' + x[:30])
ok = [s for s in specs if not probs[s]]
print(f'원고 {len(specs)} · 통과 {len(ok)}')
for s in specs:
    if probs[s]: print(' ', s, '|', ' / '.join(dict.fromkeys(probs[s]))[:300])
