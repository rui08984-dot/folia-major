import { useEffect, useRef, useState } from 'react';
import { extractColors } from '../utils/colorExtractor';
import { useReducedMotionFor } from './useReducedMotionFor';

// src/hooks/useFocusedCoverTint.ts
//
// 滑动到某张卡时，从它的封面取一个主色，交给调用方去铺背景色晕。
//
// 三条纪律（都是"要快要省"逼出来的）：
// 1) 只取**当前聚焦**那一张，不预取整个列表 —— 取色要解码一张 50×50 canvas，
//    一次性给几十张卡做会把滑动卡死。
// 2) LRU 缓存：来回滑同一批卡不该反复解码，但也不能无限涨（音乐列表很长）。
// 3) 同色不重算：连续两张卡主色一致时保持现状，省掉一次 setState 与一次重绘。

const CACHE_LIMIT = 30;
const EMPTY = '';

export const useFocusedCoverTint = (
    coverUrl: string | undefined,
    enabled: boolean,
): string => {
    const [tint, setTint] = useState<string>(EMPTY);
    const calm = useReducedMotionFor('uiMicroMotion');
    const cache = useRef<Map<string, string>>(new Map());
    const lastApplied = useRef<string>(EMPTY);

    useEffect(() => {
        if (!enabled || !coverUrl) return;

        const cached = cache.current.get(coverUrl);
        if (cached !== undefined) {
            if (cached !== lastApplied.current) {
                lastApplied.current = cached;
                setTint(cached);
            }
            return;
        }

        // 竞态守卫：滑动快时前面的取色回来得晚，不能让它盖掉当前卡的颜色。
        let cancelled = false;
        void extractColors(coverUrl, 1)
            .then(colors => {
                const color = colors[0] ?? EMPTY;
                // LRU：命中后挪到队尾，超上限时从队首淘汰。
                cache.current.delete(coverUrl);
                cache.current.set(coverUrl, color);
                while (cache.current.size > CACHE_LIMIT) {
                    const oldest = cache.current.keys().next().value;
                    if (oldest === undefined) break;
                    cache.current.delete(oldest);
                }
                if (cancelled) return;
                if (color !== lastApplied.current) {
                    lastApplied.current = color;
                    setTint(color);
                }
            })
            .catch(() => {
                // 取色失败（封面挂了/CORS）就当没有色晕，不影响任何其它表现。
            });

        return () => { cancelled = true; };
    }, [coverUrl, enabled]);

    // calm 模式下调用方会跳过过渡动画；tint 本身不变。
    void calm;
    return tint;
};
