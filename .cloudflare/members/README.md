# 노아그룹 · 노아홈페이지 회원 로그인

두 도메인의 `/member/*`만 `cc-noah-members` Worker가 처리합니다. GitHub Pages와 노아홈페이지 정적 자산 배포는 기존 경로를 사용합니다. 회원은 도메인과 공급자별로 분리됩니다.

| 사이트 | 카카오 Redirect URI | 네이버 Callback URL | Worker 설정 접두어 |
|---|---|---|---|
| 노아그룹 | https://noahgroup.co.kr/member/callback/kakao | https://noahgroup.co.kr/member/callback/naver | GROUP |
| 노아홈페이지 | https://noahhomepage.co.kr/member/callback/kakao | https://noahhomepage.co.kr/member/callback/naver | HOME |

1. 각 서비스 이름과 도메인으로 앱을 등록합니다. 카카오는 로그인을 활성화하고 Redirect URI를 입력합니다. 네이버는 PC 웹 서비스 URL에 해당 사이트의 HTTPS 주소를 입력하고 Callback URL을 등록합니다. 두 사이트는 공급자별 회원 식별자만 사용하므로 선택 프로필 항목을 추가할 필요가 없습니다.
2. Cloudflare → Workers & Pages → cc-noah-members → Settings → Variables and Secrets에서 사이트별 값을 **Secret** 유형으로 입력합니다. 접두어 뒤에 `_KAKAO_ID`(REST API 키), `_KAKAO_SECRET`, `_NAVER_ID`, `_NAVER_SECRET`을 붙입니다. 값은 저장소에 넣지 않습니다.
3. 카카오 값 두 개를 저장하면 해당 사이트의 `/member/`에서 인증을 시작할 수 있습니다. 네이버는 `/member/?review=1`에서 등록된 테스트 계정으로 먼저 확인합니다. 네이버 검수 승인 후 `GROUP_NAVER_PUBLIC` 또는 `HOME_NAVER_PUBLIC`을 문자열 `true`로 설정합니다.
4. 최초 로그인에서 약관·개인정보 수집·이용·만 14세 이상 선택과 가입 완료를 확인합니다. 로그아웃 후 같은 계정으로 다시 로그인하고, 시험 회원의 탈퇴는 본인이 직접 확인합니다.

로컬 단위 검증은 이 폴더에서 `node --test login.test.mjs`, 인증 경로 배포는 `wrangler deploy`입니다. 운영 서버에는 공급자 토큰이나 응답 본문을 기록하지 않습니다. Worker 설정 변경 뒤 재배포할 때 대시보드에서 지정한 공개 플래그를 유지합니다.
