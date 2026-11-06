# -*- coding: utf-8 -*-
"""스토어 가격표 생성기 — apps-script/shop-catalog.json 하나에서 아래를 모두 만듭니다.

  1) js/catalog.js            화면(결제창)이 쓰는 가격표
  2) apps-script/Code.gs      서버가 금액을 결정하는 SHOP_CATALOG 블록
  3) shop.html                상품 카드의 옵션 줄(<!-- pay:상품키 --> 사이), JSON-LD ItemList
  4) 루트 *.html 상단 메뉴      '서비스 · 주문' 목록의 시작 가격

사용:  python3 .claude/build/catalog/build_catalog.py          # 생성
       python3 .claude/build/catalog/build_catalog.py --check  # 생성물이 최신인지 확인(다르면 종료코드 1)
"""
import glob, html, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
CAT_PATH = os.path.join(ROOT, 'apps-script', 'shop-catalog.json')
SITE = 'https://noahgroup.co.kr/'
PRICE_VALID_UNTIL = '2027-12-31'


def rel(p):
    return os.path.join(ROOT, p)


def read(p):
    with open(rel(p), encoding='utf-8') as f:
        return f.read()


# ── 가격표 읽기·검증 ─────────────────────────────────────────────────────
def load_catalog():
    with open(CAT_PATH, encoding='utf-8') as f:
        cat = json.load(f)
    seen = set()
    key_re = re.compile(r'^[a-z][a-z0-9-]{1,30}$')
    opt_re = re.compile(r'^[a-z][a-z0-9]{1,20}$')
    for p in cat['products']:
        assert key_re.match(p['key']), p['key']
        assert p['key'] not in seen, 'duplicate product ' + p['key']
        seen.add(p['key'])
        assert isinstance(p['maxQty'], int) and 1 <= p['maxQty'] <= 1000, p['key']
        assert p['options'], p['key']
        okeys = set()
        for o in p['options']:
            assert opt_re.match(o['key']) and o['key'] not in okeys, (p['key'], o['key'])
            okeys.add(o['key'])
            assert isinstance(o['price'], int) and 100 <= o['price'] <= cat['maxOrderAmount'], (p['key'], o)
            mq = o.get('minQty', 1)
            assert isinstance(mq, int) and 1 <= mq <= p['maxQty'], (p['key'], o['key'])
        ekeys = set()
        for e in p.get('extras', []):
            assert opt_re.match(e['key'].replace('-', '')) and e['key'] not in ekeys, (p['key'], e)
            ekeys.add(e['key'])
            assert isinstance(e['price'], int) and 0 < e['price'] <= cat['maxOrderAmount'], (p['key'], e)
    return cat


def server_catalog(cat):
    """서버가 금액 계산에 쓰는 최소 정보만."""
    out = {}
    for p in cat['products']:
        out[p['key']] = {
            'name': p['name'], 'goods': p['goods'], 'unit': p['unit'], 'maxQty': p['maxQty'],
            'options': {o['key']: {'label': o['label'], 'price': o['price'], 'minQty': o.get('minQty', 1)}
                        for o in p['options']},
            'extras': {e['key']: {'label': e['label'], 'price': e['price']} for e in p.get('extras', [])},
        }
    return out


def client_catalog(cat):
    out = {'currency': cat['currency'], 'vatIncluded': cat['vatIncluded'],
           'maxOrderAmount': cat['maxOrderAmount'], 'products': {}}
    for p in cat['products']:
        out['products'][p['key']] = {
            'name': p['name'], 'card': p['card'], 'svc': p['svc'], 'unit': p['unit'], 'maxQty': p['maxQty'],
            'kmong': p['kmong'],
            'options': [{k: o[k] for k in ('key', 'label', 'price', 'summary', 'detail', 'days', 'revisions')}
                        | {'minQty': o.get('minQty', 1), 'svc': o.get('svc', p['svc'])}
                        for o in p['options']],
            'extras': [{k: e[k] for k in ('key', 'label', 'detail', 'price')} for e in p.get('extras', [])],
        }
    return out


# ── 1) js/catalog.js ─────────────────────────────────────────────────────
def build_catalog_js(cat):
    body = json.dumps(client_catalog(cat), ensure_ascii=False, indent=1)
    return ('/* 자동 생성 파일 — 직접 고치지 마세요.\n'
            '   원본: apps-script/shop-catalog.json → python3 .claude/build/catalog/build_catalog.py\n'
            '   서버(Code.gs SHOP_CATALOG)와 같은 표에서 나옵니다. 실제 결제 금액은 서버가 다시 계산합니다. */\n'
            'window.NOAH_CATALOG = Object.freeze(' + body + ');\n')


# ── 2) Code.gs 블록 ──────────────────────────────────────────────────────
GS_BEGIN = '// >>> SHOP_CATALOG — 자동 생성(apps-script/shop-catalog.json → .claude/build/catalog/build_catalog.py). 직접 고치지 마세요.'
GS_END = '// <<< SHOP_CATALOG'


def build_code_gs(cat, src):
    block = GS_BEGIN + '\nconst SHOP_CATALOG = ' + json.dumps(server_catalog(cat), ensure_ascii=False, indent=2) + ';\n' + GS_END
    pat = re.compile(re.escape(GS_BEGIN) + r'.*?' + re.escape(GS_END), re.S)
    if not pat.search(src):
        raise SystemExit('Code.gs에 SHOP_CATALOG 표식이 없습니다.')
    return pat.sub(lambda m: block, src)


# ── 3) shop.html 옵션 줄 + JSON-LD ───────────────────────────────────────
def option_name(p, o):
    return p['name'] if o['key'] == 'single' else f"{p['name']} {o['label']}"


def tier_line(p, o):
    name = option_name(p, o)
    svc = o.get('svc', p['svc'])
    return (f'<div class="st-tier"><div class="st-tier-info"><b>{html.escape(o["label"])}</b>'
            f'<span>{html.escape(o["summary"])}</span></div><div class="st-tier-buy">'
            f'<span class="st-tier-price">{o["price"]:,}<small>원</small></span>'
            f'<button type="button" class="sc-buy" data-svc="{svc}" data-opt="{html.escape(o["label"])}" '
            f'data-name="{html.escape(name)}" data-amount="{o["price"]}" data-pay="{p["key"]}:{o["key"]}">주문하기</button>'
            f'</div></div>')


def build_tiers(cat, src):
    for p in cat['products']:
        pat = re.compile(r'([ \t]*)<!-- pay:' + re.escape(p['key']) + r' -->\n.*?<!-- /pay:' + re.escape(p['key']) + r' -->', re.S)
        m = pat.search(src)
        if not m:
            raise SystemExit(f"shop.html에 <!-- pay:{p['key']} --> 표식이 없습니다.")
        ind = m.group(1)
        lines = [f'{ind}<!-- pay:{p["key"]} -->'] + [ind + tier_line(p, o) for o in p['options']] + [f'{ind}<!-- /pay:{p["key"]} -->']
        src = src[:m.start()] + '\n'.join(lines) + src[m.end():]
    return src


def card_info(src):
    """카드 순서대로 (id, h3, hook, 버튼 목록)"""
    out = []
    for aid, body in re.findall(r'<article class="st-(?:card|feature)[^"]*" id="(p-[a-z-]+)">(.*?)</article>', src, re.S):
        h3 = html.unescape(re.search(r'<h3>([^<]*)', body).group(1))
        hook = re.search(r'<p class="st-hook">(.*?)</p>', body, re.S)
        hook = html.unescape(re.sub(r'<[^>]+>', '', hook.group(1))).strip() if hook else ''
        btns = []
        for attrs in re.findall(r'<button type="button" class="sc-buy"([^>]*)>', body):
            btns.append({k: html.unescape(v) for k, v in re.findall(r'data-([a-z]+)="([^"]*)"', attrs)})
        out.append((aid, h3, hook, btns))
    return out


def jsonld_item(cat_p, o, aid, h3, hook):
    url = f'{SITE}shop.html#{aid}'
    org = {'@type': 'Organization', 'name': '노아', '@id': f'{SITE}#organization'}
    return {
        '@type': 'Service',
        'name': option_name(cat_p, o),
        'identifier': f"noah-shop:{cat_p['key']}:{o['key']}",
        'serviceType': h3,
        'description': f"{h3} — {hook} ({o['label']}: {o['summary']})",
        'url': url,
        'image': f'{SITE}og-noah-glass.png',
        'areaServed': {'@type': 'Country', 'name': 'KR'},
        'provider': {'@type': 'Organization', 'name': '노아', 'url': SITE, '@id': f'{SITE}#organization'},
        'offers': {
            '@type': 'Offer',
            'priceCurrency': 'KRW',
            'price': str(o['price']),
            'priceSpecification': {'@type': 'UnitPriceSpecification', 'price': str(o['price']),
                                   'priceCurrency': 'KRW', 'valueAddedTaxIncluded': True},
            'validFrom': '2026-11-06',
            'priceValidUntil': PRICE_VALID_UNTIL,
            'availability': 'https://schema.org/InStock',
            'url': url,
            'seller': org,
            'eligibleRegion': {'@type': 'Country', 'name': 'KR'},
        },
    }


def build_jsonld(cat, src):
    by_key = {p['key']: p for p in cat['products']}
    blocks = list(re.finditer(r'(<script type="application/ld\+json">\n)(.*?)(\n</script>)', src, re.S))
    target = None
    for b in blocks:
        d = json.loads(b.group(2))
        if isinstance(d, dict) and d.get('@type') == 'ItemList':
            target, data = b, d
            break
    if target is None:
        raise SystemExit('shop.html에 ItemList JSON-LD가 없습니다.')
    old = {it['item']['name']: it['item'] for it in data['itemListElement']}
    items = []
    for aid, h3, hook, btns in card_info(src):
        for b in btns:
            if 'pay' in b:
                pk, ok = b['pay'].split(':')
                p = by_key[pk]
                o = next(x for x in p['options'] if x['key'] == ok)
                items.append(jsonld_item(p, o, aid, h3, hook))
            else:
                it = old.get(b.get('name', ''))
                if it is None:
                    it = {'@type': 'Service', 'name': b.get('name', h3), 'serviceType': h3,
                          'description': f'{h3} — {hook}', 'url': f'{SITE}shop.html#{aid}'}
                items.append(it)
    data['itemListElement'] = [{'@type': 'ListItem', 'position': i + 1, 'item': it} for i, it in enumerate(items)]
    data['numberOfItems'] = len(items)
    data['description'] = re.sub(r'(접수하는 마케팅 서비스 )\d+종', lambda m: f'{m.group(1)}{len(items)}종',
                                 data['description'].replace('온라인 주문서로 접수하는', '온라인 결제·주문서로 접수하는'))
    body = json.dumps(data, ensure_ascii=False, indent=2)
    return src[:target.start(2)] + body + src[target.end(2):]


# ── 4) 상단 메뉴 시작 가격 ────────────────────────────────────────────────
def menu_value(p, has_other_tiers):
    lo = min(o['price'] for o in p['options'])
    tilde = '~' if (len(p['options']) > 1 or has_other_tiers) else ''
    return f'{lo:,}원{tilde}'


def build_menu(cat, src, other_tiers):
    for p in cat['products']:
        val = menu_value(p, other_tiers.get(p['card'], False))
        pat = re.compile(r'(<a href="shop\.html#' + re.escape(p['card']) + r'">[^<]*<em>)([^<]*)(</em></a>)')
        def rep(m):
            cur = m.group(2)
            if not (re.match(r'^[\d,]+원~?$', cur) or cur == '견적'):
                return m.group(0)   # '상담' 같은 별도 항목은 건드리지 않음
            return m.group(1) + val + m.group(3)
        src = pat.sub(rep, src)
    return src


# ── 실행 ────────────────────────────────────────────────────────────────
def main():
    check = '--check' in sys.argv
    cat = load_catalog()
    outputs = {}
    outputs['js/catalog.js'] = build_catalog_js(cat)
    outputs['apps-script/Code.gs'] = build_code_gs(cat, read('apps-script/Code.gs'))
    shop = build_tiers(cat, read('shop.html'))
    shop = build_jsonld(cat, shop)
    # 카드 안에 결제 옵션 말고 다른(견적) 옵션이 있는지 — 메뉴 '~' 표기용
    other = {aid: any('pay' not in b for b in btns) for aid, _, _, btns in card_info(shop)}
    outputs['shop.html'] = build_menu(cat, shop, other)
    for f in sorted(glob.glob(rel('*.html'))):
        name = os.path.relpath(f, ROOT)
        if name == 'shop.html':
            continue
        src = read(name)
        new = build_menu(cat, src, other)
        if new != src:
            outputs[name] = new
    stale = []
    for name, content in outputs.items():
        path = rel(name)
        cur = open(path, encoding='utf-8').read() if os.path.exists(path) else None
        if cur != content:
            stale.append(name)
            if not check:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
    if check:
        if stale:
            print('가격표 생성물이 최신이 아닙니다: ' + ', '.join(stale))
            sys.exit(1)
        print('가격표 생성물 최신 ✓')
    else:
        print('갱신: ' + (', '.join(stale) if stale else '변경 없음'))


if __name__ == '__main__':
    main()
