import { Member, pendingSeconds, sessionSeconds } from './member.mjs'
import { authorizeURL, identity, providerConfig, sites, unlink } from './providers.mjs'
import { render } from './page.mjs'
export { Member }

const flowCookie = '__Host-noah-flow', memberCookie = '__Host-noah-member'
const headers = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://kauth.kakao.com https://accounts.kakao.com https://nid.naver.com; frame-ancestors 'none'; base-uri 'none'",
}
const cookie = (name,value,seconds) => name + '=' + value + '; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=' + seconds
function redirect(to, cookies = []) {
  const h = new Headers({ ...headers, Location: to })
  for (const entry of cookies) h.append('Set-Cookie', entry)
  return new Response(null,{status:303,headers:h})
}
const finish = (status, cookies = []) => redirect('/member/' + (status ? '?status=' + status : ''), cookies)
const clearFlow = cookie(flowCookie, '', 0)
const clearMember = cookie(memberCookie, '', 0)
const random = () => crypto.randomUUID().replaceAll('-','')
async function hash(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))), n=>n.toString(16).padStart(2,'0')).join('')
}
const getCookie = (req,name) => (req.headers.get('Cookie') || '').split(';').map(p=>p.trim()).find(p=>p.startsWith(name+'='))?.slice(name.length+1) || ''

async function handle(req, env) {
  const url = new URL(req.url), site = sites[url.hostname]
  if (!site || url.protocol !== 'https:') return new Response(null,{status:404,headers})
  if (req.method === 'POST' && req.headers.get('Origin') !== url.origin) return new Response(null,{status:403,headers})
  const path = url.pathname
  const value = getCookie(req,memberCookie)
  let member, digest
  if (/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(value)) {
    const [id, secret] = value.split('.')
    try { member = env.MEMBERS.get(env.MEMBERS.idFromString(id)); digest = await hash(secret) } catch { /* invalid or obsolete namespace */ }
  }
  const act = async action => member ? member.act(url.hostname, digest, action) : null
  const callback = p => url.origin + '/member/callback/' + p
  const begin = (provider, action, review) => {
    const config = providerConfig(env, site, provider, review)
    if (!config) return finish('failed')
    const state = random() + random()
    const flow = [provider,action,state].join('.')
    return redirect(authorizeURL(config,callback(provider),state),[cookie(flowCookie,flow,pendingSeconds)])
  }
  if (req.method === 'GET' && path === '/member/') {
    const review = url.searchParams.get('review') === '1'
    const providers = ['kakao','naver'].filter(p=>providerConfig(env,site,p,review))
    return new Response(render(site,await act('read'),providers,review,url.searchParams.get('status')), { headers:{...headers,'Content-Type':'text/html; charset=utf-8'} })
  }
  if (req.method === 'POST') {
    if (/^\/member\/start\/(kakao|naver)$/.test(path)) return begin(path.split('/').pop(),'login',url.searchParams.get('review')==='1')
    if (path === '/member/logout') { await act('logout'); return finish('',[clearMember,clearFlow]) }
    if (path === '/member/consent') {
      if (!req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return finish('consent')
      if (Number(req.headers.get('Content-Length')) > 1024) return finish('consent')
      const data = new URLSearchParams(await req.text())
      if (!['age','terms','privacy'].every(k=>data.get(k)==='on')) return finish('consent')
      if (!await act('consent')) return finish('invalid',[clearMember])
      return finish('',[cookie(memberCookie,value,sessionSeconds)])
    }
    if (path === '/member/remove') {
      const account = await act('read')
      return account && !account.pending ? begin(account.provider,'delete',true) : finish('invalid',[clearMember])
    }
  }
  if (req.method === 'GET' && /^\/member\/callback\/(kakao|naver)$/.test(path)) {
    const provider = path.split('/').pop()
    const [issuedFor, action, state] = getCookie(req,flowCookie).split('.')
    if (issuedFor !== provider || !['login','delete'].includes(action) || !/^[a-f0-9]{64}$/.test(state || '') || state !== url.searchParams.get('state')) return finish('invalid',[clearFlow])
    if (url.searchParams.has('error')) return finish('cancel',[clearFlow])
    const code = url.searchParams.get('code'), config = providerConfig(env,site,provider,true)
    if (!code || !config) return finish('invalid',[clearFlow])
    const {id, accessToken} = await identity(config,provider,callback(provider),state,code)
    const objectId = env.MEMBERS.idFromName([url.hostname,provider,id].join(':'))
    if (action === 'delete') {
      const account = await act('read')
      if (!account || account.pending || value.split('.')[0] !== objectId.toString()) return finish('mismatch',[clearFlow])
      await unlink(config,provider,accessToken)
      await act('delete')
      return finish('removed',[clearMember,clearFlow])
    }
    const secret = random() + random()
    await env.MEMBERS.get(objectId).issue(url.hostname,provider,await hash(secret))
    return finish('',[clearFlow,cookie(memberCookie,objectId.toString()+'.'+secret,sessionSeconds)])
  }
  return new Response(null,{status:404,headers})
}
export default { async fetch(req,env) {
  try { return await handle(req,env) } catch {
    if (new URL(req.url).pathname === '/member/') {
      return new Response('회원 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.',{status:503,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}})
    }
    return finish('failed',[clearFlow])
  }
} }
