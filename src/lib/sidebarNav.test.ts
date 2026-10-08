/**
 * Sidebar navigation and width-resolution tests.
 *
 * Two things are worth pinning here. First, every page in `navStore.Page` must
 * be reachable from the sidebar exactly once: adding a page without a nav entry
 * is otherwise invisible, because `resolvedNavGroups()` silently drops unknown
 * pages. Second, the three sidebar widths are the whole layout contract, and a
 * wrong one silently breaks the push rather than throwing.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MOBILE_BREAKPOINT,
  NAV_GROUPS,
  NAV_ITEMS,
  SIDEBAR_METRICS,
  SIDEBAR_WIDTH,
  defaultNavigationOpen,
  isMobileViewport,
  isNavItemActive,
  navItemFor,
  resolveSidebarWidth,
  resolvedNavGroups,
} from './sidebarNav.ts'

/** Mirrors the `Page` union in `src/store/navStore.ts`. */
const ALL_PAGES = [
  'dashboard',
  'master-list',
  'members-history',
  'trainees',
  'koro-maker',
  'organista-suguan-maker',
  'suguan-builder',
  'suguan-history',
  'suguan-detail',
  'settings',
  'administration',
] as const

test('every navigable page has exactly one sidebar entry', () => {
  // `suguan-detail` is deliberately absent: it is a drill-down from history,
  // and `isNavItemActive` folds it into the History entry below.
  const navigable = ALL_PAGES.filter((p) => p !== 'suguan-detail')

  assert.deepEqual(
    [...NAV_ITEMS].map((i) => i.page).sort(),
    [...navigable].sort(),
  )
})

test('no page appears in two groups or twice in one group', () => {
  const seen = NAV_GROUPS.flatMap((g) => g.pages)
  assert.equal(new Set(seen).size, seen.length)
  assert.deepEqual(seen.sort(), NAV_ITEMS.map((i) => i.page).sort())
})

test('every group page resolves to a real nav item', () => {
  // The failure this guards: a typo in `pages` makes `resolvedNavGroups` drop
  // the row, so the item silently vanishes from the sidebar.
  for (const group of NAV_GROUPS) {
    for (const page of group.pages) {
      assert.ok(navItemFor(page), `${page} in "${group.label}" has no nav item`)
    }
  }
})

test('resolvedNavGroups preserves group order and item order', () => {
  const resolved = resolvedNavGroups()
  assert.deepEqual(
    resolved.map((g) => g.label),
    ['Overview', 'Choir Management', 'Suguan', 'System'],
  )
  assert.deepEqual(
    resolved.map((g) => g.items.map((i) => i.label)),
    [
      ['Dashboard'],
      ['Master List', 'Trainees', 'Members History', 'Koro Maker'],
      ['Choir Suguan', 'Organist Suguan', 'Suguan History'],
      ['Settings', 'Administration'],
    ],
  )
})

test('every nav item has a label and an icon component', () => {
  for (const item of NAV_ITEMS) {
    assert.ok(item.label.length > 0, `${item.page} has no label`)
    assert.equal(typeof item.icon, 'object', `${item.page} has no icon`)
  }
})

test('a detail page highlights its parent entry, not nothing', () => {
  // Without this the user opens a Suguan from history and no nav row lights up.
  assert.equal(isNavItemActive('suguan-detail', 'suguan-history'), true)
  assert.equal(isNavItemActive('suguan-detail', 'suguan-builder'), false)
  assert.equal(isNavItemActive('suguan-detail', 'dashboard'), false)
})

test('a page only highlights itself otherwise', () => {
  for (const item of NAV_ITEMS) {
    for (const page of ALL_PAGES) {
      const expected = page === item.page || (page === 'suguan-detail' && item.page === 'suguan-history')
      assert.equal(
        isNavItemActive(page, item.page),
        expected,
        `${page} vs ${item.page}`,
      )
    }
  }
})

test('resolveSidebarWidth covers expanded, collapsed, and hidden', () => {
  assert.equal(resolveSidebarWidth(true, true), 'w-[260px]')
  assert.equal(resolveSidebarWidth(true, false), 'w-[72px]')
  assert.equal(resolveSidebarWidth(false, true), 'w-0')
  assert.equal(resolveSidebarWidth(false, false), 'w-0')
})

test('hidden navigation wins over expansion', () => {
  // Hiding the sidebar entirely must not be overridden by "expanded"; that
  // ordering mistake is what makes a hide button look like it did nothing.
  assert.equal(resolveSidebarWidth(false, true), resolveSidebarWidth(false, false))
})

test('the documented widths match the classes the stylesheet resolves', () => {
  // 260px is the floating card and the collapsed rail is 72px. If someone
  // retunes one of these, the transition still animates but the two no longer
  // agree, and the inner content width no longer matches the outer box.
  assert.equal(SIDEBAR_WIDTH.expanded, 260)
  assert.equal(SIDEBAR_WIDTH.collapsed, 72)
  assert.equal(SIDEBAR_WIDTH.hidden, 0)
  // The drawer is never collapsed, so it gets its own width.
  assert.equal(SIDEBAR_WIDTH.drawer, 280)
  // 16px of backdrop on every side of the card, which is what makes the card's
  // height calc(100dvh - 32px) rather than full-bleed.
  assert.equal(SIDEBAR_WIDTH.margin, 16)
  assert.equal(SIDEBAR_WIDTH.margin * 2, 32)
})

test('the nav row is the same height in both states', () => {
  // The collapse animation looks wrong if the row itself resizes: a 38px
  // expanded pill inside a 44px row, and a 44px collapsed tile in that same
  // 44px row, keeps every icon on one centre line so only the label fades.
  assert.equal(SIDEBAR_METRICS.row, SIDEBAR_METRICS.itemCollapsedSize)
  assert.equal(SIDEBAR_METRICS.itemExpandedHeight, 38)
  assert.equal(SIDEBAR_METRICS.itemCollapsedSize, 44)
  assert.ok(
    SIDEBAR_METRICS.itemExpandedHeight < SIDEBAR_METRICS.row,
    'the expanded pill must fit inside the fixed row',
  )
})



test('the mobile breakpoint agrees with the navigation default', () => {
  assert.equal(MOBILE_BREAKPOINT, 768)
  assert.equal(isMobileViewport(767), true)
  assert.equal(isMobileViewport(768), false)
  assert.equal(isMobileViewport(1440), false)

  // A fresh install opens the push sidebar on desktop and starts on the drawer
  // on a phone, which is what `isNavigationOpen` defaults to.
  assert.equal(defaultNavigationOpen(1440), true)
  assert.equal(defaultNavigationOpen(768), true)
  assert.equal(defaultNavigationOpen(390), false)
})