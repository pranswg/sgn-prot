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
    builderReturnPage: null,
    previousPage: null,
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