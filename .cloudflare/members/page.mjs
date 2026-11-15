const labels = { kakao: '카카오', naver: '네이버' }
const marks = {
  kakao: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="#191919"><path d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.84 5.31 4.6 6.72l-.94 3.44c-.08.3.26.54.52.37l4.12-2.72c.56.08 1.13.12 1.7.12 5.52 0 10-3.58 10-8S17.52 3 12 3Z"/></svg> ',
  naver: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845Z"/></svg> ',
}
const messages = {
  cancel: '로그인을 취소했습니다. 원하실 때 다시 시작할 수 있습니다.',
  invalid: '로그인 요청이 만료됐거나 이전 요청입니다. 처음부터 다시 시도해 주세요.',
  failed: '로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  consent: '가입하려면 세 가지 필수 항목을 직접 선택해 주세요.',
  removed: '이 사이트의 회원정보와 로그인 세션을 삭제했습니다.',
  mismatch: '현재 회원과 같은 간편로그인 계정으로 확인해 주세요.',
}
const button = (action, label, css = '') =>
  '<form method="post" action="/member/' + action + '"><button class="' + css + '">' + (marks[css] || '') + label + '</button></form>'
export function render(site, account, providers, review, status) {
  let content
  if (account?.pending) {
    content = '<h1>회원가입</h1><p>' + labels[account.provider] + ' 계정 확인을 마쳤습니다. 아래 내용을 확인하면 ' + site.name + ' 회원가입이 완료됩니다.</p>' +
      '<form method="post" action="/member/consent"><fieldset><legend>가입 동의</legend>' +
      '<label><input type="checkbox" name="age" required> 만 14세 이상입니다 (필수)</label>' +
      '<label><input type="checkbox" name="terms" required> 이용약관에 동의합니다 (필수)</label><a href="' + site.terms + '" target="_blank" rel="noreferrer">이용약관 보기</a>' +
      '<p>회원 식별과 로그인 유지를 위해 간편로그인 서비스의 식별자에서 파생한 회원 식별값, 로그인 방식, 가입·동의 일시와 버전을 탈퇴 시까지 보관합니다. 동의를 거부하면 회원가입이 제한되며 비회원 상담은 계속 이용할 수 있습니다.</p>' +
      '<label><input type="checkbox" name="privacy" required> 개인정보 수집·이용에 동의합니다 (필수)</label><a href="' + site.privacy + '" target="_blank" rel="noreferrer">개인정보처리방침 보기</a>' +
      '</fieldset><button>동의하고 가입하기</button></form>' + button('logout','가입 취소','quiet')
  } else if (account) {
    const joined = new Intl.DateTimeFormat('ko-KR',{ timeZone:'Asia/Seoul' }).format(account.joined)
    content = '<h1>내 계정</h1><p>' + site.name + '에 ' + labels[account.provider] + ' 계정으로 로그인했습니다.</p><dl><dt>가입일</dt><dd>' + joined + '</dd></dl>' +
      button('logout','로그아웃','quiet') +
      '<details><summary>회원 탈퇴</summary><p>회원정보와 모든 로그인 세션을 삭제합니다. 같은 계정을 다시 확인하면 간편로그인 연결도 해제됩니다.</p>' +
      button('remove','본인 확인 후 탈퇴하기','quiet') + '</details>'
  } else {
    content = '<h1>로그인 · 회원가입</h1><p>' + site.name + '에서 사용할 계정을 선택하세요. 처음 방문하셨다면 인증 후 가입 동의를 받습니다.</p>' +
      providers.map(p => button('start/' + p + (review ? '?review=1' : ''), labels[p] + '로 로그인', p)).join('')
    if (!providers.length) content += '<p role="status">간편로그인을 준비하고 있습니다. 지금도 비회원으로 상담할 수 있습니다.</p>'
  }
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + site.name + ' | 회원 계정</title>' +
    '<style>*{box-sizing:border-box}body{margin:0;background:#f6f7f8;color:#1f2825;font:16px/1.65 system-ui,sans-serif;word-break:keep-all}main{width:min(100% - 32px,440px);margin:clamp(24px,8vh,84px) auto;background:white;padding:clamp(20px,5vw,36px);border:1px solid #d8dedb;border-radius:18px}header a{color:#375443;font-weight:750;text-decoration:none}h1{font-size:1.65rem;line-height:1.35}button{width:100%;min-height:48px;padding:9px;font:inherit;font-weight:700;border:0;border-radius:9px;background:#233c30;color:white;cursor:pointer;margin:5px 0}.kakao{background:#fee500;color:#191919}.naver{background:#03a94d;color:#fff}.quiet{background:#f1f3f2;color:#27332c}a{color:#274b37}fieldset{border:0;margin:12px 0;padding:0}legend,dt{font-weight:700}label{display:block;margin-top:10px}input{width:18px;height:18px;vertical-align:middle}details{margin:22px 0}summary{cursor:pointer}footer{display:flex;flex-wrap:wrap;gap:16px;margin-top:26px;font-size:14px}[role=alert]{color:#943718}dd{margin:0}</style></head><body><main><header><a href="/">' + site.name + '</a></header>' +
    (Object.hasOwn(messages,status) ? '<p role="alert">' + messages[status] + '</p>' : '') + content +
    '<footer><a href="/">홈으로</a><a href="' + site.contact + '">비회원 상담</a><a href="' + site.privacy + '">개인정보처리방침</a></footer></main></body></html>'
}
