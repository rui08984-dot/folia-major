import path from 'node:path'; import crypto from 'node:crypto';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
process.env.platform='lite'; const api=require('kugoumusicapi');
const guid=crypto.randomUUID().replace(/-/g,'').toUpperCase();
const cookies={KUGOU_API_PLATFORM:'lite',KUGOU_API_GUID:guid,KUGOU_API_MID:BigInt(`0x${crypto.createHash('md5').update(guid).digest('hex')}`).toString(10),KUGOU_API_DEV:crypto.randomBytes(5).toString('hex').toUpperCase(),KUGOU_API_MAC:Array.from(crypto.randomBytes(6)).map(v=>v.toString(16).padStart(2,'0')).join(':').toUpperCase(),KUGOU_API_WEBGL:BigInt(`0x${crypto.randomBytes(8).toString('hex').toUpperCase()}`).toString(10)};
try{const r=await api.register_dev({cookie:cookies}); if(r?.body?.data?.dfid) cookies.dfid=r.body.data.dfid;}catch{}
// 抓热评（show_hotword/p 1 前几条常带回复），找 reply_num>0
let target=null;
for(let p=1;p<=3&&!target;p++){
  const m=await api.comment_music({mixsongid:'32100650',page:p,pagesize:20,cookie:{...cookies}});
  for(const c of (m?.body?.list||m?.list||[])){ if((c.reply_num||0)>0||(c.comments_num||0)>0){target=c;break;} }
}
console.log('[target]', target?`id=${target.id} reply_num=${target.reply_num} comments_num=${target.comments_num}`:'NONE');
if(target){
  const f=await api.comment_floor({mixsongid:'32100650',tid:'32100650',special_id:String(target.id),page:1,pagesize:10,cookie:{...cookies}});
  const b=f?.body??f;
  const list=b?.list||b?.data?.list||b?.replies;
  console.log('[floor] top keys:', Object.keys(b).join(','));
  console.log('[floor] list?', Array.isArray(list)?`n=${list.length}`:'none', '| comments_num:', b?.comments_num, 'err:', b?.err_code);
  if(list&&list[0]) console.log('[floor] item0 keys:', Object.keys(list[0]).slice(0,20).join(','), '\n  sample:', JSON.stringify({id:list[0].id,content:list[0].content,user_name:list[0].user_name,like:list[0].like,pcontent:list[0].pcontent}).slice(0,200));
  require('node:fs').writeFileSync('research/comments-probe/kugou-floor.json', JSON.stringify(b,null,2));
}
process.exit(0);
