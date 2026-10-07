// 酷狗接口探针（2026-10-08）：多平台补齐前字段取证。照 electron/kugouApiBridge.cjs 的
// 调用方式直调 kugoumusicapi 模块（platform=lite + 设备 cookies），不起 Electron。
// 关注：search_suggest（联想）、top_playlist（广场+换一批翻页）、top_song（新歌段近似）、
// audio_related / playlist_similar（相似段是否吃 seed）、有无建单模块（预期：无）。

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'research', 'kugou-probe');
mkdirSync(OUT_DIR, { recursive: true });

process.env.platform = 'lite';
const api = require('kugoumusicapi');

const randomUpperHex = bytes => crypto.randomBytes(bytes).toString('hex').toUpperCase();
const guid = crypto.randomUUID().replace(/-/g, '').toUpperCase();
const cookies = {
  KUGOU_API_PLATFORM: 'lite',
  KUGOU_API_GUID: guid,
  KUGOU_API_MID: BigInt(`0x${crypto.createHash('md5').update(guid).digest('hex')}`).toString(10),
  KUGOU_API_DEV: randomUpperHex(5),
  KUGOU_API_MAC: Array.from(crypto.randomBytes(6)).map(v => v.toString(16).padStart(2, '0')).join(':').toUpperCase(),
  KUGOU_API_WEBGL: BigInt(`0x${randomUpperHex(8)}`).toString(10),
};

try {
  const reg = await api.register_dev({ cookie: cookies });
  if (reg?.body?.data?.dfid) cookies.dfid = reg.body.data.dfid;
  console.log('[probe] register_dev:', reg?.status ?? 'ok', 'dfid:', cookies.dfid ? 'present' : 'MISSING');
} catch (error) {
  console.log('[probe] register_dev failed:', error.message ?? error);
}

const call = async (name, fn, params) => {
  try {
    const result = await fn({ ...params, cookie: { ...cookies } });
    const body = result?.body ?? result;
    writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(body, null, 2));
    console.log(`[probe] ${name}: ok | ${JSON.stringify(body).slice(0, 110)}`);
    return body;
  } catch (error) {
    console.error(`[probe] ${name}: FAILED ${error.message ?? error}`);
    writeFileSync(path.join(OUT_DIR, `${name}.error.txt`), String(error));
    return null;
  }
};

const suggest = await call('search-suggest', api.search_suggest, { keywords: '晴天' });
const suggestData = suggest?.data?.[0] ?? suggest?.data;
console.log('  suggest data[0] keys:', suggestData ? Object.keys(suggestData) : JSON.stringify(suggest).slice(0, 200));

await call('top-playlist-0', api.top_playlist, { count: 5, page: 1 });
await call('top-playlist-2', api.top_playlist, { count: 5, page: 2 });
await call('top-song', api.top_song, { type_id: 1 });
const related = await call('audio-related', api.audio_related, { hash: '', album_audio_id: 25929075 });
console.log('  audio_related keys:', related ? Object.keys(related).slice(0, 8) : null);
await call('playlist-similar', api.playlist_similar, { special_id: 0 });
await call('search-album', api.search, { keywords: '周杰伦', type: 'album' });
await call('search-playlist', api.search, { keywords: '周杰伦', type: 'playlist' });

process.exit(0);
