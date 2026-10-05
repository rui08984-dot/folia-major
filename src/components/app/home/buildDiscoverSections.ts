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