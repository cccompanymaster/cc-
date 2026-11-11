"""js/track.js의 TAG_IDS에 맞춰 보안 설정(CSP 메타)과 개인정보처리방침 8항을 고칩니다.

    python3 .claude/build/tags/sync_tags.py          고치기
    python3 .claude/build/tags/sync_tags.py --check  어긋나면 1로 끝남 (자동 배포 워크플로가 실행)

ID가 빈 도구는 아무것도 추가하지 않습니다. GA4(G-9J2V6KLGLG)는 각 페이지 <head>에 직접 들어 있어 항상 켜짐으로 봅니다.
"""
import glob
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
TRACK = os.path.join(ROOT, 'js', 'track.js')
PRIVACY = os.path.join(ROOT, 'privacy.html')

TOOLS = {
    'naver': {
        'script-src': ['https://wcs.naver.net'], 'connect-src': ['https://wcs.naver.com'], 'img-src': ['https://wcs.naver.com'],
        'row': ('네이버 검색광고 프리미엄 로그분석·네이버 애널리틱스 (네이버 주식회사)', '네이버 검색·광고 유입 통계, 광고 전환 측정'), 'ad': True,
    },
    'meta': {
        'script-src': ['https://connect.facebook.net'], 'connect-src': ['https://www.facebook.com', 'https://connect.facebook.net'], 'img-src': ['https://www.facebook.com'],
        'row': ('Meta 픽셀 (Meta Platforms, Inc.)', '페이스북·인스타그램 광고 전환 측정과 맞춤형 광고'), 'ad': True,
    },
    'kakao': {
        'script-src': ['https://t1.daumcdn.net', 'https://t1.kakaocdn.net'], 'connect-src': ['https://*.ds.kakao.com'], 'img-src': ['https://*.ds.kakao.com'],
        'row': ('카카오 픽셀 (주식회사 카카오)', '카카오 광고 전환 측정과 맞춤형 광고'), 'ad': True,
    },
    'karrot': {
        'script-src': ['https://karrot-pixel.business.daangn.com'], 'connect-src': ['https://collect.daangn.com'], 'img-src': ['https://collect.daangn.com'],
        'row': ('당근 픽셀 (당근마켓 주식회사)', '당근 광고 전환 측정과 맞춤형 광고'), 'ad': True,
    },
    'clarity': {
        'script-src': ['https://www.clarity.ms', 'https://scripts.clarity.ms'], 'connect-src': ['https://*.clarity.ms'], 'img-src': ['https://*.clarity.ms', 'https://c.bing.com'],
        'row': ('Microsoft Clarity (Microsoft Corporation)', '화면 이용 분석(클릭·스크롤 위치). 입력한 글자는 가려서 수집'), 'ad': False,
    },
}
DIRECTIVES = ('script-src', 'connect-src', 'img-src')
MANAGED = {origin for tool in TOOLS.values() for d in DIRECTIVES for origin in tool[d]}
START, END = '<!-- tags:start -->', '<!-- tags:end -->'


def read_ids():
    text = open(TRACK, encoding='utf-8').read()
    block = re.search(r'var TAG_IDS = \{(.*?)\};', text, re.S)
    if not block:
        sys.exit('js/track.js: TAG_IDS 블록을 찾지 못했습니다')
    ids = dict(re.findall(r"(\w+):\s*'([^']*)'", block.group(1)))
    unknown = set(ids) - set(TOOLS)
    if unknown:
        sys.exit(f'js/track.js: 모르는 도구 {sorted(unknown)} — TOOLS에 추가하세요')
    return {k: v.strip() for k, v in ids.items()}


def fix_csp(csp, on):
    parts = []
    for part in [p.strip() for p in csp.split(';') if p.strip()]:
        name, *values = part.split()
        if name in DIRECTIVES:
            values = [v for v in values if v not in MANAGED]
            for key in on:
                values += [o for o in TOOLS[key][name] if o not in values]
        parts.append(' '.join([name, *values]))
    return '; '.join(parts) + ';'


def privacy_block(on):
    rows = ['        <tr><td>Google 애널리틱스 (Google LLC)</td><td>방문·유입 경로 통계, 문의·주문 전환 측정</td></tr>']
    rows += [f'        <tr><td>{TOOLS[k]["row"][0]}</td><td>{TOOLS[k]["row"][1]}</td></tr>' for k in on]
    ads = any(TOOLS[k]['ad'] for k in on)
    ad_note = ('\n    <p>광고 도구는 광고를 보고 들어온 방문자가 문의·주문을 했는지 확인하고, 관심 있을 만한 광고를 보여 주는 데(맞춤형 광고) 쓰입니다. '
               '행태정보는 각 광고 사업자가 정한 기간(대개 2년 이내) 동안 보관하며, 브라우저에서 쿠키를 거부하거나 휴대폰 설정에서 광고 식별자를 재설정·제한하면 맞춤형 광고를 거부할 수 있습니다.</p>') if ads else ''
    return f'''{START}
    <p>서비스 개선과 광고 성과 측정을 위해 아래 도구를 사용하며, 이 도구들은 쿠키 등으로 방문한 페이지, 누른 버튼, 기기·브라우저 종류, 대략적인 지역 같은 이용 기록(행태정보)을 수집합니다. 문의·주문 폼에 입력한 이름·연락처·내용은 이 도구들로 보내지 않습니다.</p>
    <table>
      <thead><tr><th>도구 (사업자)</th><th>수집 목적</th></tr></thead>
      <tbody>
{chr(10).join(rows)}
      </tbody>
    </table>
    <p>광고·검색·AI 답변 등으로 들어온 경우 유입 경로(광고 캠페인 이름, 검색 키워드, 들어온 사이트 주소, 처음 연 페이지, 날짜)를 이용자의 브라우저에 90일 동안 보관했다가, 문의·주문을 보낼 때 함께 저장해 광고 성과를 확인하는 데 씁니다. 개인을 알아볼 수 있는 정보는 넣지 않습니다.</p>{ad_note}
    <p>이용자는 브라우저 설정에서 쿠키 저장을 거부하거나 지울 수 있고, Google 애널리틱스는 <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener">차단 부가기능</a>으로 수집을 막을 수 있습니다. 쿠키를 거부해도 문의·주문 등 서비스 이용에는 지장이 없습니다.</p>
    {END}'''


def render():
    ids = read_ids()
    on = [k for k in TOOLS if ids.get(k)]
    out = {}
    for path in glob.glob(os.path.join(ROOT, '*.html')) + glob.glob(os.path.join(ROOT, '*', '*.html')):
        if os.sep + 'templates' + os.sep in path:
            continue
        text = open(path, encoding='utf-8').read()
        new = re.sub(r'(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")',
                     lambda m: m.group(1) + fix_csp(m.group(2), on) + m.group(3), text)
        if new != text:
            out[path] = new
    text = out.get(PRIVACY) or open(PRIVACY, encoding='utf-8').read()
    if START not in text:
        sys.exit('privacy.html: <!-- tags:start --> 표시를 찾지 못했습니다')
    a, b = text.index(START), text.index(END) + len(END)
    new = text[:a] + privacy_block(on) + text[b:]
    if new != open(PRIVACY, encoding='utf-8').read():
        out[PRIVACY] = new
    return out


def main():
    changes = render()
    names = sorted(os.path.relpath(p, ROOT) for p in changes)
    if '--check' in sys.argv:
        if changes:
            sys.exit('js/track.js의 TAG_IDS와 어긋남: ' + ', '.join(names) + ' — python3 .claude/build/tags/sync_tags.py 실행')
        print('tags: CSP·개인정보처리방침이 js/track.js와 일치')
        return
    for path, text in changes.items():
        open(path, 'w', encoding='utf-8').write(text)
    print('tags: ' + (', '.join(names) if names else '이미 최신'))


if __name__ == '__main__':
    main()
