// 酷狗楼层评论一次性探针（2026-10-08）：comment_floor 参数取证，照 kugou-probe 的调用方式。
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
} catch (e) { console.log('register failed:', e.message); }

// 晴天 album_audio_id=32100650，主评论样本首条 id=1723639894
const main = await api.comment_music({ mixsongid: '32100650', page: 1, pagesize: 3, cookie: { ...cookies } });
const body = main?.body ?? main;
const list = body?.list || [];
console.log('[main] count:', body?.count, 'n:', list.length);
const cid = list[0]?.id;
console.log('[main] first comment id:', cid, 'reply_num:', list[0]?.reply_num, 'comments_num:', list[0]?.comments_num);

const floor = await api.comment_floor({ mixsongid: '32100650', tid: '32100650', special_id: String(cid), page: 1, pagesize: 10, cookie: { ...cookies } });
const fbody = floor?.body ?? floor;
console.log('[floor] keys:', Object.keys(fbody ?? {}).slice(0, 10));
console.log('[floor]', JSON.stringify(fbody).slice(0, 600));
process.exit(0);
