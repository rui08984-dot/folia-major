import { expect, test } from './fixtures';

// test/component/discoverCards.spec.ts
// 「发现」页的两条回归防线：
//
// 1. 猜你喜欢卡必须排在第一位，且带 `id: 'personal_fm'` 与 `isFm` —— `GridView` 靠
//    `type === 'radio' && id === 'personal_fm'` 才会切进 FM 模式。这两个字段坏了不会报错，
//    只会让首页安静地少一张能刷歌的卡。
// 2. 封面加载失败必须停在**静止**占位图。少了 onError 时占位图会永远以 3 秒一圈转下去，
//    读起来像还在加载，而它已经不会成功了。

test('discover cards put the FM card first with the id GridView depends on', async ({ mount }) => {
    const probe = await mount('discoverCards');

    const items = probe.locator('[data-probe-item-id]');
    await expect(items).toHaveCount(3);

    await expect(items.first()).toHaveAttribute('data-probe-item-id', 'personal_fm');
    await expect(items.first()).toHaveAttribute('data-probe-item-fm', 'true');
    await expect(items.nth(1)).toHaveAttribute('data-probe-item-fm', 'false');
});

test('a failed cover stops on a static placeholder instead of spinning forever', async ({ mount }) => {
    const probe = await mount('discoverCards');

    const brokenCover = probe.locator('img[src*="probe-definitely-missing-cover"]');
    await expect(brokenCover).toBeVisible();
    // 等失败回调跑完：图片保持隐藏，占位图保持可见。
    await expect(brokenCover).toHaveCSS('opacity', '0');

    const placeholder = brokenCover.locator('xpath=following-sibling::div[1]');
    await expect(placeholder).toBeVisible();
    // 关键断言：不再有 animate-spin。没有这条兜底时它会永远转下去。
    await expect(placeholder.locator('svg')).not.toHaveClass(/animate-spin/);
});
