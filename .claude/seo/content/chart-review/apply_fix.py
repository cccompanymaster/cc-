# 아티클 차트 정리 공통 반영 도구 — 본문(한 줄 답~FAQ)·FAQPage LD·HowTo LD·참고 자료·설명·검토일·사이트맵·charts.json을 한 번에 고친다
# 사용: from apply_fix import apply; apply('articles/x.html', body_html, faq=[(q, a)], refs=[...li html...], ...)
import re, json, html, os, datetime
ROOT = os.path.dirname(os.path.abspath(__file__)).split('/.claude/')[0] + '/'
E = lambda s: html.escape(s, quote=False)

def faq_html(faq, heading='자주 묻는 질문', label='자주 묻는 질문'):
    return (f'<section class="article-faq" aria-label="{label}">\n          <h2>{heading}</h2>\n' +
            ''.join(f'          <details><summary>{E(q)}</summary><p>{E(a)}</p></details>\n' for q, a in faq) + '        </section>')

def apply(f, body, faq, refs, chart_status, today=None, desc=None, ogdesc=None, ld_desc=None, howto=None,
          faq_heading='자주 묻는 질문', faq_label='자주 묻는 질문', note=None, review_label=None, cta=None):
    today = today or datetime.date.today().isoformat()
    p = ROOT + f; t = open(p, encoding='utf-8').read()
    s = t.index('<div class="article-answer">')
    fs = t.index('<section class="article-faq"', s); e = t.index('</section>', fs) + len('</section>')
    t = t[:s] + body.rstrip() + '\n\n        ' + faq_html(faq, faq_heading, faq_label) + t[e:]
    ld = json.dumps({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}, ensure_ascii=False)
    t, k = re.subn(r'<script type="application/ld\+json">\{"@context":\s*"https://schema.org",\s*"@type":\s*"FAQPage".*?</script>', lambda m: '<script type="application/ld+json">' + ld + '</script>', t, count=1, flags=re.S)
    assert k == 1, 'FAQPage LD not found'
    if howto is not None:
        t, k = re.subn(r'\s*<script type="application/ld\+json">\{"@context":\s*"https://schema.org",\s*"@type":\s*"HowTo".*?</script>', ('' if howto == 'drop' else lambda m: '\n  <script type="application/ld+json">' + json.dumps(howto, ensure_ascii=False) + '</script>'), t, count=1, flags=re.S)
    m = re.search(r'(<section class="article-refs"[^>]*>\s*<h2>[^<]*</h2>\s*<ul>).*?(</ul>)', t, re.S)
    assert m, 'refs not found'
    t = t[:m.start()] + m.group(1) + '\n' + ''.join(f'          <li>{r}</li>\n' for r in refs) + '          ' + m.group(2) + t[m.end():]
    dot = today.replace('-', '.')
    if note is not None:
        t, k = re.subn(r'<p class="aa-note">.*?</p>', '<p class="aa-note">' + note + '</p>', t, count=1, flags=re.S)
    t = re.sub(r'(<span class="article-updated">)[^<]*(</span>)', lambda m: m.group(1) + (review_label or f'{dot} 검토') + m.group(2), t, count=1)
    t, k = re.subn(r'"dateModified": "[^"]*"', f'"dateModified": "{today}"', t); assert k >= 1
    if desc:
        t = re.sub(r'(<meta name="description" content=")[^"]*(")', lambda m: m.group(1) + html.escape(desc, quote=True) + m.group(2), t, count=1)
    if ogdesc:
        t = re.sub(r'(<meta property="og:description" content=")[^"]*(")', lambda m: m.group(1) + html.escape(ogdesc, quote=True) + m.group(2), t, count=1)
        t = re.sub(r'(<meta name="twitter:description" content=")[^"]*(")', lambda m: m.group(1) + html.escape(ogdesc, quote=True) + m.group(2), t, count=1)
    if ld_desc:
        t = re.sub(r'("@type": "(?:Article|BlogPosting|TechArticle)"[^<]*?"description": ")[^"]*(")', lambda m: m.group(1) + ld_desc.replace('"', '\\"') + m.group(2), t, count=1)
    if cta:
        old, new = cta
        assert t.count(old) == 1, 'cta text not found'; t = t.replace(old, new)
    open(p, 'w', encoding='utf-8').write(t)
    sm = ROOT + 'sitemap-articles.xml'; x = open(sm, encoding='utf-8').read()
    x, k = re.subn(r'(<loc>https://noahgroup\.co\.kr/' + re.escape(f) + r'</loc>\s*<lastmod>)[^<]*', r'\g<1>' + today, x); assert k == 1, 'sitemap entry'
    open(sm, 'w', encoding='utf-8').write(x)
    cj = ROOT + '.claude/seo/content/chart-review/charts.json'; rows = json.load(open(cj, encoding='utf-8'))
    base = f.split('/')[-1][:-5]
    for r in rows:
        key = r['id'].split('#')[1]
        if r['id'].startswith(base + '#') and key in chart_status:
            r['status'], r['note'] = chart_status[key]; r['date'] = today
    json.dump(rows, open(cj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    sync_meta(f)
    return t

# 목록 데이터 맞추기 — 피드 두 개(제목·설명), llms-full.txt 줄, 인벤토리(제목·수정일·FAQ 수)를 글의 현재 <title>·설명·dateModified에 맞춘다
# apply()가 끝에 부르고, 제목을 swap_all로 바꾼 뒤에도 다시 부른다
def sync_meta(f):
    t = open(ROOT + f, encoding='utf-8').read()
    desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', t).group(1))
    title = html.unescape(re.search(r'<title>(.*?)</title>', t, re.S).group(1)).rsplit(' | ', 1)[0]
    url = 'https://noahgroup.co.kr/' + f
    def fix(m):
        it = m.group(0)
        if f'<link>{url}</link>' not in it: return it
        it = re.sub(r'<description>.*?</description>', lambda _: '<description>' + E(desc) + '</description>', it, count=1, flags=re.S)
        return re.sub(r'<title>.*?</title>', lambda _: '<title>' + E(title) + '</title>', it, count=1, flags=re.S)
    for fd in ('feed.xml', 'feed-articles.xml'):
        s = open(ROOT + fd, encoding='utf-8').read()
        open(ROOT + fd, 'w', encoding='utf-8').write(re.sub(r'<item>.*?</item>', fix, s, flags=re.S))
    s = open(ROOT + 'llms-full.txt', encoding='utf-8').read()
    open(ROOT + 'llms-full.txt', 'w', encoding='utf-8').write(re.sub(r'^- \[[^\]]*\]\(' + re.escape(url) + r'\): .*$', lambda _: f'- [{title}]({url}): {desc}', s, flags=re.M))
    p = ROOT + '.claude/seo/content/inventory.json'; inv = json.load(open(p, encoding='utf-8'))
    for i in inv:
        if i['url'] == f:
            i['title'], i['mod'], i['faq'] = title, re.search(r'"dateModified": "([^"]*)"', t).group(1), len(re.findall(r'<details><summary>', t))
    open(p, 'w', encoding='utf-8').write(json.dumps(inv, ensure_ascii=False, indent=0) + '\n')

def check(f):
    t = open(ROOT + f, encoding='utf-8').read()
    def walk(o):
        if isinstance(o, dict):
            yield o
            for v in o.values(): yield from walk(v)
        elif isinstance(o, list):
            for v in o: yield from walk(v)
    lds = [json.loads(m) for m in re.findall(r'<script type="application/ld\+json">(.*?)</script>', t, re.S)]
    faq = [n for ld in lds for n in walk(ld) if n.get('@type') == 'FAQPage'][0]
    ld = [(q['name'], q['acceptedAnswer']['text']) for q in faq['mainEntity']]
    vis = [(html.unescape(re.sub('<[^>]+>', '', q)).strip(), html.unescape(re.sub('<[^>]+>', '', a)).strip()) for q, a in re.findall(r'<details><summary>(.*?)</summary><p>(.*?)</p></details>', t, re.S)]
    return ld == vis, len(ld), t.count('class="section-illust"')

# 제목·카드 문구 바꾸기 — 사이트 전체 텍스트 파일에서 old → new (정확히 같은 문자열만). 반환: {파일: 바꾼 횟수}
# 대상: 공개 파일(html·xml·txt) + 인벤토리·OG 카드 데이터. .git·node_modules·templates·나머지 .claude는 제외
def swap_all(old, new, only=None):
    import glob
    files = [p for ext in ('html', 'xml', 'txt') for p in glob.glob(ROOT + f'**/*.{ext}', recursive=True)
             if '/.claude/' not in p and '/node_modules/' not in p and '/.git/' not in p and '/templates/' not in p]
    files += [ROOT + '.claude/seo/content/inventory.json', ROOT + '.claude/seo/og/cards.json']
    out = {}
    for p in files:
        rel = p[len(ROOT):]
        if only and rel not in only: continue
        t = open(p, encoding='utf-8').read(); k = t.count(old)
        if k: open(p, 'w', encoding='utf-8').write(t.replace(old, new)); out[rel] = k
    return out
