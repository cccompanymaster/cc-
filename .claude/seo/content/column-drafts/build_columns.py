# 새 칼럼 생성기 — column/blog-ad-cost.html의 틀(상단바·스타일·CTA·허브·푸터)에 specs/<slug>.json 원고를 넣는다
# 사용: python3 build_columns.py slug1 slug2 ...  (인자 없으면 specs 전체) / --out DIR 로 저장 위치 변경
import re, json, html, sys, os, glob
D = os.path.dirname(os.path.abspath(__file__)) + '/'
ROOT = D.split('/.claude/')[0] + '/' if '/.claude/' in D else '/home/user/cc-/'
CAT = {'ad': '광고 플랫폼', 'expo': '상위노출', 'blog': '블로그 운영', 'industry': '업종별 마케팅', 'pro': '전문직 마케팅',
       'medical': '병원·의료', 'job': '블로그 부업', 'viral': '바이럴·에이전시', 'exp': '체험단'}
DATE, DATE_DOT = '2026-10-22', '2026.10.22'
EXTRA_CSS = ('.tbl{overflow-x:auto;margin:18px 0}table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:520px}'
             'th,td{padding:10px 12px;border:1px solid var(--line);text-align:left;vertical-align:top;line-height:1.6}'
             'th{background:rgba(154,125,74,.08);color:var(--gold-soft);font-weight:800;white-space:nowrap}td{color:var(--sub)}'
             'caption{caption-side:top;text-align:left;font-size:12.5px;color:var(--gold);font-weight:700;padding-bottom:8px}'
             '.src{margin:26px 0 0;font-size:12px;color:var(--dim);line-height:1.9}.src a{color:var(--gold-soft);text-decoration:underline}'
             'article b,article strong{color:var(--gold-soft)}')
tpl = open(ROOT + 'column/blog-ad-cost.html', encoding='utf-8').read()
esc = lambda s: html.escape(s, quote=False)
att = lambda s: html.escape(s, quote=True)

def titles():
    # 링크 문구 = 대상 페이지의 <title>에서 ' | 사이트명' 뺀 것
    t = {}
    for f in glob.glob(ROOT + 'column/*.html') + glob.glob(ROOT + 'guide/*.html') + glob.glob(ROOT + 'articles/*.html'):
        m = re.search(r'<title>(.*?)</title>', open(f, encoding='utf-8').read(), re.S)
        if not m: continue
        name = html.unescape(m.group(1)).split(' | ')[0].strip()
        rel = f[len(ROOT):]
        t[rel[7:] if rel.startswith('column/') else '../' + rel] = name
    for f in glob.glob(D + 'specs/*.json'):
        s = json.load(open(f, encoding='utf-8')); t[s['slug'] + '.html'] = s['title']
    return t

PUBLISHING = set()
def live(href):
    # 기존 파일이거나 이번에 함께 발행하는 글이면 링크 유지
    return not href.endswith('.html') or '/' in href or os.path.exists(ROOT + 'column/' + href) or href[:-5] in PUBLISHING

ALLOWED = re.compile(r'</?(p|ul|ol|li|b)>|<a href="[^"]+">|</a>')
def clean(h, links):
    h = re.sub(r'<a href="([a-z0-9-]+\.html)">(.*?)</a>', lambda m: m.group(0) if live(m.group(1)) else m.group(2), h)
    rest = ALLOWED.sub('', h)
    bad = re.findall(r'<[^>]+>', rest)
    assert not bad, ('허용 안 된 태그', bad[:3])
    for href in re.findall(r'<a href="([^"]+)">', h):
        assert href in links, ('없는 링크', href)
    return h

def sub1(s, pat, rep):
    n = len(re.findall(pat, s, re.S)); assert n == 1, (pat, n)
    return re.sub(pat, lambda m: rep, s, count=1, flags=re.S)

def build(sp, links):
    slug, cat = sp['slug'], CAT[sp['cat']]
    url = f'https://noahgroup.co.kr/column/{slug}.html'
    title, desc = sp['title'], sp['description']
    # ── 본문 ──
    t = sp['table']
    tbl = ('<div class="tbl"><table><caption>' + esc(t['caption']) + '</caption><thead><tr>' +
           ''.join(f'<th>{esc(c)}</th>' for c in t['head']) + '</tr></thead><tbody>' +
           ''.join('<tr>' + ''.join(f'<td>{esc(c)}</td>' for c in r) + '</tr>' for r in t['rows']) + '</tbody></table></div>')
    secs = []
    for i, s in enumerate(sp['sections']):
        secs.append(f'<h2>{esc(s["h2"])}</h2>\n{clean(s["html"], links)}')
        if i == t.get('after_section', 0): secs.append(tbl)
    faq = ''.join(f'<details><summary>{esc(f["q"])}</summary><div class="fb">{esc(f["a"])}</div></details>' for f in sp['faq'])
    src = ' · '.join(f'<a href="{att(s["url"])}" rel="noopener" target="_blank">{esc(s["name"])}</a>' for s in sp.get('sources', []))
    src_p = f'<p class="src">참고 자료 — {src}{" · " if src else ""}기준일 {DATE}</p>'
    art = (f'<article>\n<h1>{esc(sp["h1_main"])}<br><span class="grad">{esc(sp["h1_sub"])}</span></h1>\n'
           f'<div class="meta"><span class="cat">#{cat}</span><span>{DATE_DOT}</span><span>노아 편집팀</span></div>\n'
           f'<p class="lead">{esc(sp["lead"])}</p>\n' + '\n'.join(secs) + '\n'
           f'<h2>노아의 방식</h2>\n<p>{esc(sp["noah"])}</p>\n'
           f'<div class="chk"><h2>{esc(sp["checklist"]["title"])}</h2><ul>' + ''.join(f'<li>{esc(x)}</li>' for x in sp['checklist']['items']) + '</ul></div>\n'
           f'<div class="faq"><h2>자주 묻는 질문</h2>{faq}</div>\n{src_p}\n</article>')
    rel = '<div class="rel"><h2>함께 읽으면 좋은 글</h2>' + ''.join(f'<a href="{r}">{esc(links[r])}</a>' for r in sp['related'] if live(r)) + '</div>'
    # ── 구조화 데이터 (화면 FAQ와 같은 데이터) ──
    lds = [
        {"@context": "https://schema.org", "@type": "Article", "headline": title, "description": desc, "datePublished": DATE, "dateModified": DATE,
         "inLanguage": "ko", "articleSection": cat, "keywords": ", ".join(sp['keywords']),
         "author": {"@type": "Organization", "name": "노아", "@id": "https://noahgroup.co.kr/#organization"},
         "publisher": {"@type": "Organization", "name": "노아", "url": "https://noahgroup.co.kr", "@id": "https://noahgroup.co.kr/#organization"},
         "mainEntityOfPage": url},
        {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": f['q'], "acceptedAnswer": {"@type": "Answer", "text": f['a']}} for f in sp['faq']]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "홈", "item": "https://noahgroup.co.kr/"},
            {"@type": "ListItem", "position": 2, "name": "마케팅 칼럼", "item": "https://noahgroup.co.kr/column/"},
            {"@type": "ListItem", "position": 3, "name": sp['keyword'], "item": url}]},
    ]
    ld_html = ''.join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>\n' for x in lds)
    out = tpl
    out = re.sub(r'(<script type="application/ld\+json">.*?</script>\s*)+', lambda m: ld_html, out, count=1, flags=re.S)
    assert out.count('application/ld+json') == 3
    out = sub1(out, r'<title>.*?</title>', f'<title>{esc(title)} | 노아 마케팅 칼럼</title>')
    out = sub1(out, r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{att(desc)}">')
    out = sub1(out, r'<meta name="keywords" content="[^"]*">', f'<meta name="keywords" content="{att(", ".join(sp["keywords"]))}">')
    out = sub1(out, r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url}">')
    out = sub1(out, r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{att(title)}">')
    out = sub1(out, r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{att(desc)}">')
    out = sub1(out, r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{url}">')
    out = sub1(out, r'</style>', EXTRA_CSS + '</style>')
    out = sub1(out, r'<nav class="crumb".*?</nav>', f'<nav class="crumb" aria-label="현재 위치"><a href="../">홈</a> › <a href="./">마케팅 칼럼</a> › {cat}</nav>')
    out = sub1(out, r'<article>.*?</article>', art)
    out = re.sub(r'(<div class="cta">\s*<h2>)[^<]*(</h2>)', lambda m: m.group(1) + esc(sp['cta_title']) + m.group(2), out, count=1)
    out = sub1(out, r'<div class="rel"><h2>함께 읽으면 좋은 글</h2>.*?</div>', rel)
    return out

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    outdir = ROOT + 'column/'
    if '--out' in sys.argv: outdir = sys.argv[sys.argv.index('--out') + 1]; args = [a for a in args if a != outdir]
    links = titles()
    specs = [json.load(open(D + f'specs/{s}.json', encoding='utf-8')) for s in args] if args else \
            [json.load(open(f, encoding='utf-8')) for f in sorted(glob.glob(D + 'specs/*.json'))]
    PUBLISHING.update(sp['slug'] for sp in specs)
    os.makedirs(outdir, exist_ok=True)
    for sp in specs:
        open(os.path.join(outdir, sp['slug'] + '.html'), 'w', encoding='utf-8').write(build(sp, links))
        print('built', sp['slug'])
