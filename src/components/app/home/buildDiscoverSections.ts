import type { UnifiedSong } from '../../../types';

// src/components/app/home/buildDiscoverSections.ts
// 「发现」页的分段装配，纯函数，便于单测。
//
// 顺序有语义：先是「跟这个账号有关」的（猜你喜欢/相似/雷达/新歌），全部是直接铺歌的长条。
// 歌单广场不在这里 —— 那是编辑选出来的大盘热门，归电台页，两个入口不重复。
// 空段一律丢弃：没有内容就不出这一段，绝不放一个空壳让人以为是坏了。

export type DiscoverSectionId = 'personal-fm' | 'similar' | 'radar' | 'new-songs';

export type DiscoverSection = {
    id: DiscoverSectionId;
    title: string;
    /** 说明这一段为什么出现在这里，比如相似歌曲注明种子是哪首。 */
    subtitle?: string;
    songs: readonly UnifiedSong[];
};

/**
 * 私人FM 卡的 id。
 *
 * ⚠️ 这个值不是随便取的：`GridView` 认 `type === 'radio' && id === 'personal_fm'` 才会切进
 * FM 模式（队列末尾自动补歌由 `usePlaybackQueueController` 接）。改了它等于静默关掉刷歌，
 * 而首页只是少一张卡，肉眼看不出坏了。
 */
export const PERSONAL_FM_CARD_ID = 'personal_fm';

export const buildDiscoverSections = ({
    fmSongs,
    similarSongs,
    radarSongs,
    newSongs,
    /** 有没有「此刻在听」的种子。没有时相似歌曲整段不出现。 */
    hasSeed,
    titles,
    similarSeedLabel,
}: {
    fmSongs: readonly UnifiedSong[];
    similarSongs: readonly UnifiedSong[];
    radarSongs: readonly UnifiedSong[];
    newSongs: readonly UnifiedSong[];
    hasSeed: boolean;
    /** 标题在调用侧翻译好再传进来，这里保持纯函数、不碰 i18n。 */
    titles: { personalFm: string; similar: string; radar: string; newSongs: string };
    /** 相似歌曲段的副标题，如「跟着正在播放的〈xxx〉」。 */
    similarSeedLabel?: string;
}): DiscoverSection[] => ([
    {
        id: 'personal-fm' as const,
        title: titles.personalFm,
        songs: fmSongs,
    },
    ...(hasSeed ? [{
        id: 'similar' as const,
        title: titles.similar,
        ...(similarSeedLabel ? { subtitle: similarSeedLabel } : {}),
        songs: similarSongs,
    }] : []),
    {
        id: 'radar',
        title: titles.radar,
        songs: radarSongs,
    },
    {
        id: 'new-songs' as const,
        title: titles.newSongs,
        songs: newSongs,
    },
] as DiscoverSection[]).filter(section => section.songs.length > 0);

/**
 * 发现页歌曲卡的 id。
 *
 * 🔴 必须带段 id：发现页四段（猜你喜欢/相似/雷达/新歌）之间没有去重，同一首歌完全可以
 * 同时出现在两段里（FM 要的是「现在适合你的」，雷达要的是「同风格正在火的」，重合很常见）。
 * 只按 mediaId 编 id 会让 React 撞 same key —— 它不会抛异常崩溃，而是随机丢弃/错位子节点
 * （React 的告警原文就是 "children to be duplicated and/or omitted"），现象是往后拉时卡片
 * 莫名消失、变成空块、位置乱跳，盯渲染代码永远看不出问题。2026-10-08 实测复现。
 */
export const buildDiscoverSongCardId = (sectionId: string, song: UnifiedSong): string =>
    `discover-song-${sectionId}-${String(song.sourceRef?.mediaId ?? song.id)}`;

/** 同一首歌在两个键下算同一首：跨源播放键优先，退化到歌曲自身 id。 */
const discoverSongDedupeKey = (song: UnifiedSong): string => (
    String(song.sourceRef?.mediaId ?? song.id)
);

/**
 * 跨段去重：同一首歌只保留它第一次出现的那一段。
 *
 * 用户在发现页刷到两遍同一首歌只会以为推荐坏了；而播放队列用的仍是该段完整队列
 * （调用侧自己保留 section.songs），所以去重不掉任何可播内容。
 */
export const dedupeDiscoverSongs = (sections: readonly DiscoverSection[]): DiscoverSection[] => {
    const seen = new Set<string>();
    return sections.map(section => {
        const songs = section.songs.filter(song => {
            const key = discoverSongDedupeKey(song);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        return songs.length === section.songs.length ? section : { ...section, songs };
    });
};
