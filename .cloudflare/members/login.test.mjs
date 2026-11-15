import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sites, providerConfig, authorizeURL, identity } from './providers.mjs'
import { render } from './page.mjs'

const site = sites['noahgroup.co.kr']
const fixture = { GROUP_NAVER_ID:'test-only', GROUP_NAVER_SECRET:'test-only' }
test('네이버 공개 전 검수와 사이트별 자격증명을 분리한다', () => {
  assert.equal(providerConfig(fixture,site,'naver'),null)
  const config = providerConfig(fixture,site,'naver',true)
  assert.equal(new URL(authorizeURL(config,'https://noahgroup.co.kr/member/callback/naver','nonce')).host,'nid.naver.com')
  assert.equal(providerConfig(fixture,sites['noahhomepage.co.kr'],'naver',true),null)
  assert.equal(providerConfig({...fixture,GROUP_NAVER_PUBLIC:'true'},site,'naver').name,'네이버')
})
test('네이버 응답에서 회원 식별자만 사용하고 자격증명 리디렉션을 거부한다',async()=>{
  const config=providerConfig(fixture,site,'naver',true)
  const responses=[{access_token:'fixture'}, {resultcode:'00',response:{id:'stub',email:'test@example.invalid'}}]
  const send=async(url,options)=>{
    assert.equal(options.redirect,'manual')
    return Response.json(responses.shift())
  }
  const user=await identity(config,'naver','https://example.invalid/member/callback/naver','nonce','code',send)
  assert.deepEqual(user,{id:'stub',accessToken:'fixture'})
  await assert.rejects(identity(config,'naver','https://example.invalid/','nonce','code',async()=>Response.redirect('https://elsewhere.invalid/',302)))
})
test('첫 가입의 필수 동의는 기본 미선택이며 비회원 경로를 제공한다',()=>{
  const html=render(site,{pending:true,provider:'kakao'},[],false,'')
  assert.equal((html.match(/type="checkbox"/g)||[]).length,3)
  assert.doesNotMatch(html,/\schecked\b/)
  assert.match(html,/비회원 상담/)
})
