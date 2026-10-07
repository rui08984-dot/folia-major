import { create } from 'zustand';
import { getPlaybackSongKey } from '../utils/appPlaybackGuards';
import type { SongResult } from '../types';

// src/stores/useDislikedSongsStore.ts
//
// 记「不感兴趣」过的歌的跨源 key。为什么要有这一层：QQ 的 feedback_radio 只把负反馈发给服务端、
// 不回替补曲，而发现页队列又是刻意「稳定不自动刷新」的（用户上一轮定的）。两者叠加的结果就是
// 用户反馈的「点了不感兴趣，歌还在列表里、点进去还得再点一次」。
//
// 官方「猜你喜欢」点不感兴趣的表现是：那首歌从推荐流里去掉、不再出现。这里对齐它——dislike 记一个
// key，发现页各段渲染时把命中的歌过滤掉（卡立刻消失），并且下次拉取/换一批也照样过滤（不再冒回来）。
// 这是客户端侧的过滤，不改变「服务端口味模型何时更新」这件事（那是 QQ 的慢变量，客户端管不着）。

const STORAGE_KEY = 'folia.disliked-songs';
const DISLIKED_LIMIT = 500;

const loadKeys = (): string[] => {
    if (typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string' && k.length > 0) : [];
    } catch {
        return [];
    }
};

type DislikedSongsState = {
    keys: string[];
    has: (song: SongResult) => boolean;
    add: (song: SongResult) => void;
    clear: () => void;
};

const persist = (keys: string[]) => {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(keys)); } catch { /* 写失败静默 */ }
};

export const useDislikedSongsStore = create<DislikedSongsState>((set, get) => ({
    keys: loadKeys(),
    has: (song) => {
        const key = getPlaybackSongKey(song);
        return Boolean(key) && get().keys.includes(key);
    },
    add: (song) => {
        const key = getPlaybackSongKey(song);
        if (!key) return;
        const current = get().keys;
        if (current.includes(key)) return;
        const next = [key, ...current].slice(0, DISLIKED_LIMIT);
        persist(next);
        set({ keys: next });
    },
    clear: () => { persist([]); set({ keys: [] }); },
}));
