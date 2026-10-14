/**
 * Navigation tests.
 *
 * The focus is the "start a new Suguan" dialog: entering the builder swaps the
 * page immediately, so the store has to remember where the user came from in
 * order to put them back when they dismiss the dialog without choosing. The
 * second concern is the back button: with no router, `previousPage` is the only
 * record of where the user was before the current screen.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { useNavStore, type Page } from './navStore.ts'

function reset(page: Page = 'dashboard') {
  useNavStore.setState({
    page,
    selectedSuguanId: null,
    builderSuguanId: null,
    extraOccasionSuguanId: null,
    extraOccasionBatchId: null,
    extraOccasionMode: null,
    builderReturnPage: null,
    previousPage: null,
    directoryStart: null,
  })
}

test('entering the builder from another page remembers where the user was', () => {
  // The sidebar, mobile bottom nav, and breadcrumb all call `navigate`, not
  // `startNewSuguan`, so this path must record the origin too.
  for (const from of ['suguan-history', 'dashboard', 'master-list', 'settings'] as const) {
    reset(from)
    useNavStore.getState().navigate('suguan-builder')
    assert.equal(useNavStore.getState().page, 'suguan-builder')
    assert.equal(
      useNavStore.getState().builderReturnPage,
      from,
      `origin lost when entering the builder from ${from}`,
    )
  }
})

test('the New Suguan button remembers the page it was pressed on', () => {
  reset('suguan-history')
  useNavStore.getState().startNewSuguan()
  assert.equal(useNavStore.getState().page, 'suguan-builder')
  assert.equal(useNavStore.getState().builderSuguanId, null)
  assert.equal(useNavStore.getState().builderReturnPage, 'suguan-history')
})

test('dismissing the dialog returns to where the user was', () => {
  // This is the backdrop click: it must not strand the user on an empty builder.
  reset('suguan-history')
  useNavStore.getState().navigate('suguan-builder')

  const returned = useNavStore.getState().dismissNewSuguan()
  assert.equal(returned, 'suguan-history')
  assert.equal(useNavStore.getState().page, 'suguan-history')
  // The origin is spent, so a second dismiss cannot bounce anywhere.
  assert.equal(useNavStore.getState().builderReturnPage, null)
  assert.equal(useNavStore.getState().dismissNewSuguan(), null)
})

test('dismissing with no remembered origin stays put', () => {
  // A deliberate "start over" from inside the builder has nowhere to go back to.
  reset('suguan-builder')
  useNavStore.getState().startNewSuguan()
  assert.equal(useNavStore.getState().builderReturnPage, null)

  assert.equal(useNavStore.getState().dismissNewSuguan(), null)
  assert.equal(useNavStore.getState().page, 'suguan-builder')
})

test('dismissing straight from the dashboard still returns to the dashboard', () => {
  reset('dashboard')
  useNavStore.getState().startNewSuguan()
  assert.equal(useNavStore.getState().dismissNewSuguan(), 'dashboard')
})

test('committing to a draft drops the origin so it cannot fire later', () => {
  reset('suguan-history')
  useNavStore.getState().startNewSuguan()
  useNavStore.getState().clearBuilderReturnPage()
  assert.equal(useNavStore.getState().builderReturnPage, null)
  // Still in the builder, now with a real draft: dismissing must not navigate.
  assert.equal(useNavStore.getState().dismissNewSuguan(), null)
  assert.equal(useNavStore.getState().page, 'suguan-builder')
})

test('navigating somewhere unrelated retires the origin', () => {
  reset('suguan-history')
  useNavStore.getState().navigate('suguan-builder')
  useNavStore.getState().navigate('settings')
  assert.equal(useNavStore.getState().builderReturnPage, null)
  assert.equal(useNavStore.getState().dismissNewSuguan(), null)
  assert.equal(useNavStore.getState().page, 'settings')
})

test('editing a saved Suguan does not arm a return, because no dialog opens', () => {
  reset('suguan-history')
  useNavStore.getState().editSuguanInBuilder('sg1')
  assert.equal(useNavStore.getState().page, 'suguan-builder')
  assert.equal(useNavStore.getState().builderSuguanId, 'sg1')
  assert.equal(useNavStore.getState().builderReturnPage, null)
})

test('editing an Extra Occasion record opens its maker and plain navigation clears the edit target', () => {
  reset('suguan-history')
  useNavStore.getState().editExtraOccasionSuguan('extra-1')
  assert.equal(useNavStore.getState().page, 'extra-occasion-suguan')
  assert.equal(useNavStore.getState().extraOccasionSuguanId, 'extra-1')
  assert.equal(useNavStore.getState().extraOccasionMode, 'single')

  useNavStore.getState().navigate('suguan-history')
  assert.equal(useNavStore.getState().extraOccasionSuguanId, null)
})

test('navigating to the Extra Occasion page opens the chooser', () => {
  reset('dashboard')
  useNavStore.getState().navigate('extra-occasion-suguan')
  assert.equal(useNavStore.getState().extraOccasionMode, 'choose')
  assert.equal(useNavStore.getState().extraOccasionBatchId, null)
})

test('leaving the Extra Occasion page clears its workflow state', () => {
  reset('dashboard')
  useNavStore.getState().openExtraOccasionBatch('batch-1')
  assert.equal(useNavStore.getState().extraOccasionMode, 'multi')
  assert.equal(useNavStore.getState().extraOccasionBatchId, 'batch-1')

  useNavStore.getState().navigate('dashboard')
  assert.equal(useNavStore.getState().extraOccasionMode, null)
  assert.equal(useNavStore.getState().extraOccasionBatchId, null)
})

test('switching workflow keeps the page but changes the mode', () => {
  reset('dashboard')
  useNavStore.getState().navigate('extra-occasion-suguan')
  useNavStore.getState().setExtraOccasionMode('multi')
  assert.equal(useNavStore.getState().page, 'extra-occasion-suguan')
  assert.equal(useNavStore.getState().extraOccasionMode, 'multi')
})

test('re-entering the builder from the builder does not arm a self-return', () => {
  reset('suguan-builder')
  useNavStore.getState().navigate('suguan-builder')
  assert.equal(useNavStore.getState().builderReturnPage, null)
  assert.equal(useNavStore.getState().dismissNewSuguan(), null)
})

test('navigating records the page left behind for the back button', () => {
  reset('master-list')
  useNavStore.getState().navigate('settings')
  assert.equal(useNavStore.getState().page, 'settings')
  assert.equal(useNavStore.getState().previousPage, 'master-list')
})

test('re-tapping the current page cannot point the back button at itself', () => {
  reset('master-list')
  useNavStore.getState().navigate('settings')
  useNavStore.getState().navigate('settings')
  assert.equal(useNavStore.getState().previousPage, 'master-list')

  useNavStore.getState().goBack()
  assert.equal(useNavStore.getState().page, 'master-list')
  // Coming back the other way records Settings as the page left behind.
  useNavStore.getState().navigate('settings')
  assert.equal(useNavStore.getState().previousPage, 'master-list')
})

test('back with no recorded page lands on the dashboard', () => {
  useNavStore.setState({ page: 'settings', previousPage: null })
  useNavStore.getState().goBack()
  assert.equal(useNavStore.getState().page, 'dashboard')
})

test('back cannot target the screen it is already on', () => {
  // Settings → builder → dismissing the start dialog swaps the page back to
  // Settings without updating `previousPage`, which still says "settings".
  // Without the guard, goBack navigates to Settings and nothing moves.
  useNavStore.setState({ page: 'settings', previousPage: 'settings' })
  useNavStore.getState().goBack()
  assert.equal(useNavStore.getState().page, 'dashboard')
})

test('dashboard KPI cards carry a one-shot directory view into the Master List', () => {
  reset('dashboard')
  useNavStore.getState().navigateToDirectory('active')
  assert.equal(useNavStore.getState().page, 'master-list')
  assert.equal(useNavStore.getState().directoryStart, 'active')
  assert.equal(useNavStore.getState().builderReturnPage, null)
})

test('MasterListPage forgets the directory view after consuming it', () => {
  useNavStore.setState({ directoryStart: 'female' })
  useNavStore.getState().clearDirectoryStart()
  assert.equal(useNavStore.getState().directoryStart, null)
})

test('a plain navigation never replays an old directory view', () => {
  useNavStore.setState({ directoryStart: 'male' })
  useNavStore.getState().navigate('master-list')
  assert.equal(useNavStore.getState().page, 'master-list')
  assert.equal(useNavStore.getState().directoryStart, null)
})

test('navigateToDirectory records the page left behind for the back button', () => {
  reset('dashboard')
  useNavStore.getState().navigateToDirectory('all')
  assert.equal(useNavStore.getState().previousPage, 'dashboard')
})