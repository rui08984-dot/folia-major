// 网易云接口探针（2026-10-08）：多平台补齐前的字段取证，沿用 QQ 轮方法论——
// 快照是映射的唯一依据，探针不过不写对接代码。匿名 cookie 即可验证形状；
// 需登录态的（/playlist/create、个性化推荐质量）在端到端阶段用真机补测。

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'research', 'netease-probe');
mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'http://127.0.0.1:13399';
const { serveNcmApi } = require('@neteasecloudmusicapienhanced/api/server.js');
await serveNcmApi({ port: 13399, host: '127.0.0.1' });
console.log('[probe] netease api listening on', BASE);

const anonRes = await fetch(`${BASE}/register/anonimous?timestamp=${Date.now()}`).then(r => r.json());
const anonCookie = typeof anonRes?.cookie === 'string' ? anonRes.cookie : '';
console.log('[probe] anonymous cookie:', anonCookie ? 'present' : 'MISSING');

const probes = [
  ['search-suggest', '/search/suggest?keywords=%E6%99%B4%E5%A4%A9'],
  ['search-suggest-pc', '/search/suggest/pc?keywords=%E6%99%B4%E5%A4%A9'],
  ['simi-song', '/simi/song?id=186016'],
  ['personalized', '/personalized?limit=10'],
  ['personalized-newsong', '/personalized/newsong'],
  ['top-playlist-offset0', '/top/playlist?limit=5&offset=0'],
  ['top-playlist-offset5', '/top/playlist?limit=5&offset=5'],
  ['search-album', '/search?keywords=%E5%91%A8%E6%9D%B0%E4%BC%A6&type=10'],
  ['search-playlist', '/search?keywords=%E5%91%A8%E6%9D%B0%E4%BC%A6&type=1000'],
  ['playlist-create-anon', '/playlist/create?name=probe-test'],
];

for (const [name, endpoint] of probes) {
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${BASE}${endpoint}${separator}timestamp=${Date.now()}`;
  try {
    const res = await fetch(url, {
      headers: anonCookie ? { Cookie: anonCookie } : {},
    });
    const body = await res.json();
    writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(body, null, 2));
    const summary = JSON.stringify(body).slice(0, 120);
    console.log(`[probe] ${name}: HTTP ${res.status} | ${summary}`);
  } catch (error) {
    console.error(`[probe] ${name}: FAILED ${error.message}`);
    writeFileSync(path.join(OUT_DIR, `${name}.error.txt`), String(error));
  }
}
process.exit(0);
