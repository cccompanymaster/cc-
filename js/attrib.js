/* attrib.js — 방문자가 어디서 들어왔는지(광고·검색·SNS·AI 답변) 기억해 두었다가
   상담·소개서·주문·사전정보 신청에 함께 보냄 → 구글 시트 '유입' 칸에서 어느 광고가 실제 상담을 만들었는지 확인
   - 이 브라우저에만 저장(localStorage, 90일). 이름·연락처 같은 개인정보는 저장하지 않음
   - 담는 것: 광고 매개변수(utm_*, 네이버 검색광고 n_keyword 등), 클릭 ID가 있었는지 여부(값은 저장 안 함),
     들어오기 직전 사이트의 도메인, 처음 본 페이지, 날짜
   - AI 답변(ChatGPT·Perplexity·Claude·Gemini·Copilot 등)에서 들어오면 GA4에 ai_referral 이벤트 */
(() => {
  const KEY = 'noah_src';
  const TTL = 90 * 864e5;
  const q = new URLSearchParams(location.search);
  const val = (k) => (q.get(k) || '').trim().slice(0, 80);

  let ref = '';
  try {
    if (document.referrer) {
      const h = new URL(document.referrer).hostname.replace(/^www\./, '');
      if (h && h !== location.hostname.replace(/^www\./, '')) ref = h;
    }
  } catch (_) {}

  const AI = [
    [/(^|\.)(chatgpt\.com|openai\.com)$/, 'ChatGPT'], [/(^|\.)perplexity\.ai$/, 'Perplexity'],
    [/(^|\.)claude\.ai$/, 'Claude'], [/^(gemini|bard)\.google\.com$/, 'Gemini'],
    [/(^|\.)copilot\.microsoft\.com$|(^|\.)copilot\.cloud\.microsoft$/, 'Copilot'],
    [/(^|\.)wrtn\.ai$/, '뤼튼'], [/^clova-x\.naver\.com$/, 'CLOVA X'], [/(^|\.)liner\.com$/, 'Liner'],
    [/(^|\.)you\.com$/, 'You.com'], [/(^|\.)phind\.com$/, 'Phind'], [/(^|\.)deepseek\.com$/, 'DeepSeek'],
    [/(^|\.)grok\.com$/, 'Grok'],
  ];
  const aiOf = (s) => (AI.find(([re]) => re.test(s)) || [])[1] || '';
  const SEARCH = /(^|\.)(google\.[a-z.]+|naver\.com|daum\.net|bing\.com|search\.yahoo\.com|zum\.com|duckduckgo\.com|ecosia\.org)$/;
  const SOCIAL = /(^|\.)(instagram\.com|facebook\.com|threads\.net|t\.co|x\.com|youtube\.com|blog\.naver\.com|cafe\.naver\.com|kakao\.com|band\.us|tiktok\.com)$/;

  // 이번 방문이 어디서 왔나
  let now = null;
  const us = val('utm_source');
  if (us) {
    now = { s: us, m: val('utm_medium') || '(없음)', c: val('utm_campaign'), k: val('utm_term') || val('utm_content') };
  } else if (q.has('n_media') || q.has('n_query') || q.has('n_keyword')) {
    now = { s: 'naver', m: 'cpc', c: val('n_campaign_type') && '검색광고', k: val('n_keyword') || val('n_query') };
  } else if (q.has('gclid') || q.has('gbraid') || q.has('wbraid')) {
    now = { s: 'google', m: 'cpc' };
  } else if (q.has('fbclid')) {
    now = { s: 'meta', m: ref && /facebook|instagram/.test(ref) ? 'social' : 'paid?' };
  } else if (ref) {
    const ai = aiOf(ref);
    now = ai ? { s: ai, m: 'ai' } : { s: ref, m: SEARCH.test(ref) ? 'organic' : SOCIAL.test(ref) ? 'social' : 'referral' };
  }
  const aiNow = now && (now.m === 'ai' ? now.s : aiOf(String(now.s).replace(/^www\./, '')));
  if (aiNow && now.m !== 'ai') now.m = 'ai';

  let rec = null;
  try { rec = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
  if (rec && Date.now() - (rec.first?.t || 0) > TTL) rec = null;
  if (now) {
    now.lp = location.pathname.slice(0, 60);
    now.t = Date.now();
    rec = rec || { first: now };
    rec.last = now;
  } else if (!rec) {
    rec = { first: { s: '(direct)', m: '(none)', lp: location.pathname.slice(0, 60), t: Date.now() } };
  }
  try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch (_) {}

  if (aiNow && typeof gtag === 'function') {
    gtag('event', 'ai_referral', { ai_source: aiNow, landing_page: location.pathname });
  }

  const date = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const fmt = (x) => {
    if (!x) return '';
    let s = x.s === '(direct)' ? '직접 방문' : `${x.s} / ${x.m}`;
    if (x.c) s += ` · ${x.c}`;
    if (x.k) s += ` 「${x.k}」`;
    return `${s} → ${x.lp} (${date(x.t)})`;
  };
  // 신청서에 붙일 한 줄: 처음 들어온 경로, (다르면) 마지막 경로, 신청한 페이지
  window.NOAH_SRC = {
    get: () => rec,
    text: () => {
      if (!rec) return '';
      const first = fmt(rec.first);
      const last = rec.last && rec.last.t !== rec.first.t ? fmt(rec.last) : '';
      return (`처음: ${first}` + (last ? ` | 최근: ${last}` : '') + ` | 신청: ${location.pathname}`).slice(0, 480);
    },
  };
})();
