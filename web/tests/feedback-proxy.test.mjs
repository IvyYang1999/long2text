import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import test from 'node:test'

/** 代理是安全边界：只放行三条路径，后台接口绝不能从站点这边透出去。 */
const source = readFileSync(new URL('../src/app/support/[...path]/route.ts', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../src/components/RootShell.tsx', import.meta.url), 'utf8')

test('白名单只有三条，且不含后台接口', () => {
  const allowed = source.match(/ALLOWED = new Set\(\[(.*?)\]\)/s)[1]
  assert.deepEqual(
    allowed.split(',').map((s) => s.trim().replace(/"/g, '')).filter(Boolean),
    ['widget.js', 'api/feedback', 'api/thread', 'api/attachment']
  )
  assert.ok(!allowed.includes('admin'), '后台接口不能出现在白名单里')
})

test('只转发必要的请求头，不整包透传 cookie 或 authorization', () => {
  assert.ok(!/authorization/i.test(source), '不能转发 authorization')
  assert.ok(!/cookie/i.test(source), '不能转发 cookie')
  assert.ok(source.includes('x-feedback-token'), '访客凭证要转发')
  assert.ok(source.includes('x-forwarded-for'), '真实 IP 要带给上游，否则限流会误伤')
})

test('查询串要转发，否则读图拿不到 id', () => {
  assert.match(source, /new URL\(request\.url\)\.search/)
  assert.match(source, /\$\{UPSTREAM\}\/\$\{route\}\$\{query\}/)
})

test('接口响应不缓存，脚本才缓存', () => {
  assert.match(source, /route === "widget\.js" \? "public, max-age=\d+" : "no-store"/)
})

test('站点上挂的是同源路径，不是第三方域名', () => {
  assert.ok(shell.includes('src="/support/widget.js"'), '脚本要走同源路径')
  assert.ok(shell.includes('data-api="/support"'), '接口也要走同源路径')
  assert.ok(!/dc-feedback-sigma/.test(shell), '页面里不该出现第三方反馈域名')
})
