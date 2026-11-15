export const sites = {
  'noahgroup.co.kr': { name: '노아그룹', prefix: 'GROUP', privacy: '/privacy.html', terms: '/terms.html', contact: '/contact.html' },
  'noahhomepage.co.kr': { name: '노아홈페이지', prefix: 'HOME', privacy: '/privacy', terms: '/terms', contact: '/contact' },
}
const endpoints = {
  kakao: { name: '카카오', authorize: 'https://kauth.kakao.com/oauth/authorize', token: 'https://kauth.kakao.com/oauth/token', profile: 'https://kapi.kakao.com/v2/user/me' },
  naver: { name: '네이버', authorize: 'https://nid.naver.com/oauth2.0/authorize', token: 'https://nid.naver.com/oauth2.0/token', profile: 'https://openapi.naver.com/v1/nid/me' },
}
export function providerConfig(env, site, provider, review = false) {
  if (!Object.hasOwn(endpoints, provider)) return null
  const prefix = site.prefix + '_' + provider.toUpperCase()
  const id = env[prefix + '_ID'], secret = env[prefix + '_SECRET']
  if (!id || !secret || (provider === 'naver' && !review && env[prefix + '_PUBLIC'] !== 'true')) return null
  return { ...endpoints[provider], id, secret }
}
export function authorizeURL(config, callback, state) {
  const target = new URL(config.authorize)
  target.search = new URLSearchParams({ client_id: config.id, redirect_uri: callback, state, response_type: 'code' })
  return target.href
}
export async function identity(config, provider, callback, state, code, send = fetch) {
  const result = await send(config.token, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(8000),
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.id, client_secret: config.secret, redirect_uri: callback, state, code }) })
  if (!result.ok) throw Error('token')
  const { access_token } = await result.json()
  if (typeof access_token !== 'string' || !access_token) throw Error('token')
  const url = new URL(config.profile)
  if (provider === 'kakao') url.searchParams.set('property_keys', '[]')
  const profile = await send(url, { headers: { Authorization: 'Bearer ' + access_token }, redirect: 'manual', signal: AbortSignal.timeout(8000) })
  if (!profile.ok) throw Error('profile')
  const data = await profile.json()
  const id = provider === 'kakao' && Number.isSafeInteger(data.id) ? String(data.id)
    : provider === 'naver' && data.resultcode === '00' ? data.response?.id : null
  if (typeof id !== 'string' || !id || id.length > 256) throw Error('subject')
  return { id, accessToken: access_token }
}
export async function unlink(config, provider, accessToken, send = fetch) {
  const options = { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(8000) }
  if (provider === 'kakao') {
    const result = await send('https://kapi.kakao.com/v1/user/unlink', { ...options, headers: { Authorization: 'Bearer ' + accessToken } })
    if (!result.ok) throw Error('unlink')
  } else {
    const body = new URLSearchParams({ grant_type: 'delete', client_id: config.id, client_secret: config.secret, access_token: accessToken, service_provider: 'NAVER' })
    const result = await send(config.token, { ...options, body })
    if (!result.ok || (await result.json()).result !== 'success') throw Error('unlink')
  }
}
