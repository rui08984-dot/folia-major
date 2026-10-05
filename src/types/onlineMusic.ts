import type { LyricData, ReplayGainInfo, SongResult, UnifiedSong } from '../types';

// src/types/onlineMusic.ts

export type MediaId = string | number;
export type OnlineProviderId = 'netease' | (string & {});
export type AudioQualityPreference = 'standard' | 'high' | 'lossless' | 'hires';
export type ProviderCatalogEntityKind = 'album' | 'artist' | 'playlist';

export interface ProviderCatalogRef {
    providerId: OnlineProviderId;
    kind: ProviderCatalogEntityKind;
    id: MediaId;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type PlaybackSourceRef =
    | {
        kind: 'online';
        providerId: OnlineProviderId;
        mediaId: string;
        variant?: string;
        providerData?: Record<string, JsonValue>;
    }
    | { kind: 'local'; mediaId: string }
    | { kind: 'navidrome'; mediaId: string }
    | { kind: 'stage'; mediaId: string };

export interface ProviderCapabilities {
    search: boolean;
    playback: boolean;
    lyrics: boolean;
    auth: boolean;
    userLibrary: boolean;
    playlists: boolean;
    albums: boolean;
    artists: boolean;
    recommendations: boolean;
    mutations: boolean;
    /** Personal FM can be steered by mode/scene, i.e. `getPersonalFm` honours PersonalFmRequestOptions. */
    personalFmModes?: boolean;
    wordByWordLyrics: boolean;
    userCloud?: boolean;
    historyRecommendations?: boolean;
    playlistSubscription?: boolean;
    playlistTrackMutations?: boolean;
    likes?: boolean;
    userAlbums?: boolean;
    /** The provider accepts a listening report for a track the user actually played. */
    playbackReports?: boolean;
}

export interface ProviderAvailability {
    configured: boolean;
    reason?: 'not-configured' | 'runtime-unavailable';
}

export interface ProviderAccountSummary {
    providerId: OnlineProviderId;
    displayName: string;
    shortName: string;
    availability: ProviderAvailability;
    /** False for a provider with no account at all (a Folium mod source): it is used without signing in. Absent means true. */
    requiresAccount?: boolean;
    status: 'unknown' | 'authenticated' | 'anonymous' | 'error';
    user: ProviderUser | null;
    collections: ProviderCollection[];
    error?: string;
    hydration?: 'loading' | 'ready';
    freshness?: 'stale' | 'refreshing' | 'fresh' | 'error';
    lastUpdatedAt?: number;
}

export interface ProviderPage<T> {
    items: T[];
    total?: number;
    hasMore: boolean;
    nextOffset: number;
}

export interface ProviderAudioSource {
    url: string;
    fetchedAt: number;
    expiresAt?: number;
    quality: AudioQualityPreference;
    replayGain?: ReplayGainInfo;
}

export type ProviderSongAvailabilityState = 'playable' | 'unavailable' | 'unknown';

export interface ProviderSongAvailability {
    state: ProviderSongAvailabilityState;
    label?: string;
}

export interface ProviderSongReplacement {
    song: UnifiedSong;
    label?: string;
}

export interface ChorusRange {
    startTime: number;
    endTime: number;
}

export interface ProviderLyricsResult {
    lyrics: LyricData | null;
    mainText?: string | null;
    wordByWordText?: string | null;
    translationText?: string | null;
    romanizationText?: string | null;
    isPureMusic: boolean;
    chorusRanges?: ChorusRange[];
}

export interface ProviderAlbumSummary {
    id: MediaId;
    name: string;
    coverUrl?: string;
    entityId?: string;
    catalogRef?: ProviderCatalogRef;
}

export interface ProviderSongMetadata {
    artists: ProviderArtistSummary[];
    album: ProviderAlbumSummary;
    durationMs: number;
    coverUrl?: string;
    aliases: string[];
    translatedNames: string[];
}

export interface ProviderUser {
    id: MediaId;
    nickname: string;
    avatarUrl?: string;
    backgroundUrl?: string;
    vipType?: number;
}

export interface ProviderArtistSummary {
    id: MediaId;
    name: string;
    entityId?: string;
    catalogRef?: ProviderCatalogRef;
}

export interface ProviderHistoryEntry {
    id: string;
    label: string;
    providerData?: Record<string, JsonValue>;
}

export interface ProviderCollection {
    providerId: OnlineProviderId;
    id: MediaId;
    name: string;
    type: 'playlist' | 'album' | 'artist' | 'radio' | 'cloud' | string;
    coverUrl?: string;
    description?: string;
    trackCount?: number;
    albumCount?: number;
    isOwned?: boolean;
    creator?: ProviderUser;
    artists?: ProviderArtistSummary[];
    aliases?: string[];
    publishedAt?: number;
    publisher?: string;
    playCount?: number;
    updatedAt?: number;
    tracksUpdatedAt?: number;
    isLiked?: boolean;
    providerData?: Record<string, JsonValue>;
}

export type QrLoginState =
    | { state: 'waiting' }
    | { state: 'scanned' }
    | { state: 'confirmed' }
    | { state: 'expired' }
    | { state: 'error'; message?: string };

// 扫码登录失败的几种形态，决定登录弹窗要不要给出「复制诊断信息」入口。
// 没扫码就过期属于正常情况，不算失败；扫过码却过期，多半是手机端确认被拒。
export type QrLoginFailureKind =
    | 'start-error'
    | 'check-error'
    | 'expired-after-scan'
    | 'account-refresh-failed';

export type ProviderErrorCode =
    | 'auth-required'
    | 'unsupported'
    // 集合设为不公开，当前这条读取路径没资格读它。与 `unsupported`（这个后端或 provider 没有这项能力）
    // 分开，界面才能只在这种情况下给出「不是公开歌单」的解释。
    | 'not-public'
    | 'unavailable'
    | 'not-playable'
    | 'network'
    | 'invalid-response';

export class OnlineProviderError extends Error {
    constructor(
        public readonly code: ProviderErrorCode,
        message: string,
        public readonly providerId?: OnlineProviderId,
        public readonly cause?: unknown,
    ) {
        super(message);
        this.name = 'OnlineProviderError';
    }
}

/** 搜索框联想的单条建议：value 是选中后填进搜索框的文本，detail 是副行（如歌手名）。 */
export type OnlineSearchSuggestion = {
    kind: 'song' | 'singer';
    value: string;
    detail?: string;
    /** 单曲联想带一份正规化好的可播歌曲：点联想直接播，不经过结果页。 */
    song?: UnifiedSong;
};

export interface OnlineSearchProvider {
    searchSongs(query: string, limit: number, offset: number): Promise<ProviderPage<UnifiedSong>>;
    /** 输入联想（QQ smartbox）。没实现就没有联想，调用方按空数组处理。 */
    getSmartboxSuggestions?(query: string): Promise<OnlineSearchSuggestion[]>;
    /** 专辑/歌单类型搜索，返回集合卡；点卡片走现有集合详情，不新做 UI。 */
    searchCollections?(query: string, limit: number, offset: number): Promise<ProviderPage<ProviderCollection>>;
}

export interface OnlinePlaybackProvider {
    getSongDetail(id: MediaId): Promise<UnifiedSong | null>;
    getAudioSource(song: SongResult, quality: AudioQualityPreference): Promise<ProviderAudioSource | null>;
    getAvailability?(song: SongResult): ProviderSongAvailability;
    getReplacement?(song: SongResult): Promise<ProviderSongReplacement | null>;
}

/**
 * One finished listening report, in the only two units a provider can be told the truth in:
 * how many seconds of this track were really rendered, and how long the track is.
 *
 * `playedSeconds` is never a position on the progress bar - a listener who drags to the end has
 * not listened to the song. Callers must hand over accumulated playback and must already have
 * capped it at `totalSeconds`; nothing downstream can tell an inflated number from a real one.
 */
export interface ProviderPlaybackReport {
    playedSeconds: number;
    totalSeconds?: number;
    quality?: AudioQualityPreference;
}

export interface OnlinePlaybackReportProvider {
    reportPlayback(song: SongResult, report: ProviderPlaybackReport): Promise<void>;
}

export interface OnlineLyricsProvider {
    getLyrics(song: SongResult, context?: { userId?: MediaId | null }): Promise<ProviderLyricsResult>;
    getChorusRanges?(songId: MediaId): Promise<ChorusRange[]>;
}

export interface OnlineSongMetadataProvider {
    getSongMetadata(song: SongResult): ProviderSongMetadata;
}

// provider 自行声明它支持哪几种扫码登录方式；不声明即代表只有单一方式，UI 维持单步流程。
export interface QrLoginMethod {
    id: string;          // 传给后端的识别值（QQ: 'qq' | 'wechat'）
    labelKey: string;    // i18n key，由 UI 层翻译
    iconKey: string;     // 图标识别值，由 UI 层映射到静态资源
}

export interface OnlineAuthProvider {
    getLoginStatus(): Promise<ProviderUser | null>;
    logout(): Promise<void>;
    getQrLoginMethods?(): QrLoginMethod[];
    // 需要远端能力发现的 provider 在这里等待结果；UI 用同一份返回值决定单步或多步流程。
    resolveQrLoginMethods?(): Promise<QrLoginMethod[]>;
    getQrKey?(methodId?: string): Promise<string>;
    createQr?(key: string): Promise<string>;
    checkQr?(key: string): Promise<QrLoginState>;
    // 只释放这一把 key 的会话，实现必须是幂等的：调用方在关窗时 fire-and-forget，
    // 未知或已过期的 key 也算成功。没有会话概念的 provider 不必实现。
    cancelQr?(key: string): Promise<void>;
    // 二维码的有效期。声明了它，UI 才会自己计时并在到点时停止轮询、给出重试；
    // 不声明就沿用原本的做法——只认后端报出的过期状态。
    getQrTtlMs?(): number;
    // 扫码登录失败后附进诊断报告的 provider 专属信息，每项一行、已格式化好。
    // 只能返回可以公开贴出来的内容：不含 cookie、token、IP 或账号信息。
    getQrLoginDiagnostics?(): Promise<string[]>;
}

export interface OnlineLibraryProvider {
    getUserPlaylists(userId: MediaId, limit: number, offset: number): Promise<ProviderPage<ProviderCollection>>;
    getLikedSongIds?(userId: MediaId): Promise<MediaId[]>;
    /** Full liked-track records, used when a provider needs more than the song id (e.g. KuGou fileId). */
    getLikedSongs?(userId: MediaId): Promise<UnifiedSong[]>;
    getUserAlbums?(userId: MediaId, limit: number, offset: number): Promise<ProviderPage<ProviderCollection>>;
    getCloudCollection?(user?: ProviderUser): Promise<ProviderCollection | null>;
}

export interface OnlineCatalogProvider {
    canResolveSongCatalogRefs?(song: UnifiedSong): boolean;
    resolveSongCatalogRefs?(song: UnifiedSong): Promise<UnifiedSong>;
    getPlaylistTracks?(id: MediaId, limit: number, offset: number, collection?: ProviderCollection): Promise<ProviderPage<UnifiedSong>>;
    getPlaylistDetail?(id: MediaId, collection?: ProviderCollection): Promise<ProviderCollection | null>;
    getCloudTracks?(limit: number, offset: number, collection?: ProviderCollection): Promise<ProviderPage<UnifiedSong>>;
    getAlbumTracks?(id: MediaId, limit?: number, offset?: number, collection?: ProviderCollection): Promise<ProviderPage<UnifiedSong>>;
    getAlbumDetail?(id: MediaId, collection?: ProviderCollection): Promise<ProviderCollection | null>;
    getArtistSongs?(id: MediaId, limit: number, offset: number): Promise<ProviderPage<UnifiedSong>>;
    getArtistAlbums?(id: MediaId, limit: number, offset: number): Promise<ProviderPage<ProviderCollection>>;
    getArtistDetail?(id: MediaId): Promise<ProviderCollection | null>;
    getSubscriptionStatus?(type: 'playlist' | 'album', id: MediaId, collection?: ProviderCollection): Promise<boolean>;
}

/**
 * Personal FM tuning, provider-neutral on purpose: only NetEase's `/personal/fm/mode` understands
 * these, and a provider without the concept ignores them rather than failing the call.
 */
export interface PersonalFmRequestOptions {
    mode?: string;
    submode?: string | null;
}

export interface OnlineRecommendationProvider {
    getDailySongs?(refresh?: boolean): Promise<UnifiedSong[]>;
    getPersonalFm?(options?: PersonalFmRequestOptions): Promise<UnifiedSong[]>;
    /**
     * `context.seedSongId` 让 provider 能补一段「与当前这首相关」的内容。没有种子就只给
     * 账号级的推荐 —— 传不传都必须能用，所以它是可选参数而不是另开一个方法。
     *
     * `context.scope` 选要哪一半：'personalized' 只要「跟这个账号有关」的（猜你喜欢/相似/雷达/新歌），
     * 'editorial' 只要编辑选出来的歌单广场，'all'（默认）都要。
     * 两个首页入口是两个语义不同的面：发现是「给你的」，电台是「大家都在听的」。
     * 不分开的话两个 tab 会长得一模一样，用户无从判断该点哪个。
     * `context.from` 是歌单广场的批次偏移（换一批用）；provider 不支持就当 0，不支持换批不算错。
     */
    getRecommendedCollections?(
        limit: number,
        context?: { seedSongId?: MediaId; from?: number; scope?: 'personalized' | 'editorial' | 'all' },
    ): Promise<ProviderCollection[]>;
    /**
     * 按一首种子歌推同类。与 getPersonalFm 的差别：前者按账号画像给，后者按「此刻在听什么」给，
     * 两者不能互相替代 —— 猜你喜欢换一百次也是那个口味，相似歌曲才会跟着当前这首走。
     */
    getSimilarSongs?(seed: MediaId, limit?: number): Promise<UnifiedSong[]>;
    /**
     * 取某一段推荐的具体歌曲，`section` 由 provider 自己定义（如 QQ 的 'radar' / 'new-songs'）。
     * 与 `getRecommendedCollections` 的虚拟行是同一批数据的两种视图：那边给的是「一列歌」的壳子，
     * 这边给的是壳子里的歌本身 —— 首页要平铺歌曲而不是让人点进去才看到，就要靠它。
     * 与酷狗的推荐 cardId 是同一个约定。
     */
    getRecommendationRowSongs?(
        section: string,
        options?: { seedSongId?: MediaId; limit?: number },
    ): Promise<UnifiedSong[]>;
    getHistoryEntries?(): Promise<ProviderHistoryEntry[]>;
    getHistoryDates?(): Promise<string[]>;
    getHistorySongs?(entry: ProviderHistoryEntry | string): Promise<UnifiedSong[]>;
    dislikeSong?(id: MediaId): Promise<{ replacement?: UnifiedSong; limitReached?: boolean }>;
}

export interface OnlineMutationProvider {
    canAddToPlaylist?(playlist: ProviderCollection): boolean;
    likeSong?(
        song: MediaId | SongResult,
        liked: boolean,
        context?: { likedFileId?: MediaId },
    ): Promise<void>;
    updatePlaylistTracks?(
        operation: 'add' | 'del',
        playlist: MediaId | ProviderCollection,
        tracks: Array<MediaId | SongResult>,
    ): Promise<void>;
    /** Create an owned playlist in the user's account and return it normalized. */
    createPlaylist?(dirName: string): Promise<ProviderCollection>;
    subscribePlaylist?(playlist: MediaId | ProviderCollection, subscribed: boolean): Promise<void>;
    subscribeAlbum?(id: MediaId, subscribed: boolean): Promise<void>;
}

export interface OnlineMusicProvider {
    id: OnlineProviderId;
    displayName: string;
    shortName?: string;
    getAvailability?(): ProviderAvailability;
    capabilities: ProviderCapabilities;
    normalizeSong(raw: unknown): UnifiedSong;
    normalizeUser?(raw: unknown): ProviderUser;
    normalizeCollection?(raw: unknown, type?: string): ProviderCollection;
    songMetadata?: OnlineSongMetadataProvider;
    getSongPageUrl?(song: SongResult): string | null;
    search?: OnlineSearchProvider;
    playback?: OnlinePlaybackProvider;
    playbackReports?: OnlinePlaybackReportProvider;
    lyrics?: OnlineLyricsProvider;
    auth?: OnlineAuthProvider;
    library?: OnlineLibraryProvider;
    catalog?: OnlineCatalogProvider;
    recommendations?: OnlineRecommendationProvider;
    mutations?: OnlineMutationProvider;
}

// Public canonical contract consumed through the omni facade. Provider-prefixed
// names above remain internal adapter vocabulary while the migration completes.
export type OmniProviderId = OnlineProviderId;
export type OmniMediaId = MediaId;
export type OmniProviderCapabilities = ProviderCapabilities;
export type OmniProviderAvailability = ProviderAvailability;
export type OmniProviderSummary = ProviderAccountSummary;
export type OmniAccountState = ProviderAccountSummary;
export type OmniPage<T> = ProviderPage<T>;
export type OmniAudioSource = ProviderAudioSource;
export type OmniSongAvailability = ProviderSongAvailability;
export type OmniSongReplacement = ProviderSongReplacement;
export type OmniLyricsResult = ProviderLyricsResult;
export type OmniPlaybackReport = ProviderPlaybackReport;
export type OmniChorusRange = ChorusRange;
export type OmniAlbum = ProviderAlbumSummary;
export type OmniArtist = ProviderArtistSummary;
export type OmniUser = ProviderUser;
export type OmniCollection = ProviderCollection;
export type OmniHistoryEntry = ProviderHistoryEntry;
export { OnlineProviderError as OmniError };
