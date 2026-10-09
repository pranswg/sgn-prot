import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DirectoryStartView } from '@/lib/memberDirectory'

export type Page =
  | 'dashboard'
  | 'master-list'
  | 'trainees'
  | 'members-history'
  | 'koro-maker'
  | 'organista-suguan-maker'
  | 'suguan-builder'
  | 'suguan-history'
  | 'suguan-detail'
  | 'settings'
  | 'administration'

interface NavState {
  page: Page
  selectedSuguanId: string | null
  builderSuguanId: string | null
  /**
   * The member whose Members History timeline should open on the next visit
   * to the Members History page. Set when "View History" is chosen from the
   * duplicate-detection dialog, so the archive opens on the right person.
   * Cleared on every plain navigation, like `directoryStart`.
   */
  selectedHistoryMemberId: string | null
  /**
   * The page to return to if the "start a new Suguan" dialog is dismissed
   * without a choice. `null` when there is nothing to go back to.
   *
   * Entering the builder swaps the page immediately, so without this the
   * builder is already mounted behind the dialog and dismissing it would strand
   * the user on an empty step 0 instead of putting them back where they were.
   */
  builderReturnPage: Page | null
  /**
   * The page left behind by the last `navigate`, so a screen that renders its
   * own back button — Settings on mobile — has somewhere to return to. There is
   * no router, so this is the only record of "where I came from".
   * `null` before the first navigation.
   */
  previousPage: Page | null
  navigate: (page: Page) => void
  /** Goes to `previousPage`, or the dashboard when there is nowhere to go. */
  goBack: () => void
  /**
   * One-shot initial directory view for the next Master List visit, set by the
   * dashboard KPI cards. MasterListPage reads it while first rendering and
   * clears it via `clearDirectoryStart`, so a later plain `navigate` to the
   * Master List never re-applies an old filtered view.
   */
  directoryStart: DirectoryStartView | null
  /**
   * Jump to the Master List with a KPI card's view pre-applied, rather than
   * landing on the wide-open directory.
   */
  navigateToDirectory: (start: DirectoryStartView) => void
  clearDirectoryStart: () => void
  openSuguanDetail: (id: string) => void
  /**
   * Navigate to the Members History page with a member's timeline open,
   * e.g. from the duplicate-detection dialog's "View History" action.
   */
  openMemberHistoryDetail: (memberId: string) => void
  /** Reads and clears the one-shot `selectedHistoryMemberId` flag. */
  consumeSelectedHistoryMemberId: () => string | null
  startNewSuguan: () => void
  /** Returns to `builderReturnPage`, or `null` if there is nowhere to go back to. */
  dismissNewSuguan: () => Page | null
  /** Forgets the remembered return page once the user has committed to a draft. */
  clearBuilderReturnPage: () => void
  editSuguanInBuilder: (id: string) => void
}

export const useNavStore = create<NavState>()(
  persist(
    (set, get) => ({
      page: 'dashboard',
      selectedSuguanId: null,
      builderSuguanId: null,
      selectedHistoryMemberId: null,
      builderReturnPage: null,
      previousPage: null,
      directoryStart: null,
      navigate: (page) =>
        set((s) => ({
          page,
          selectedSuguanId: null,
          builderSuguanId: null,
          // A plain navigation must not re-open a remembered history timeline.
          selectedHistoryMemberId: null,
          // Tapping the page you are already on leaves the back destination alone,
          // so a repeated tap on Settings cannot point the back button at itself.
          previousPage: s.page === page ? s.previousPage : s.page,
          // Entering the builder from anywhere records where the user was, so
          // dismissing the start dialog can send them back. The sidebar, the mobile
          // bottom nav, and the breadcrumb all route through here, not through
          // `startNewSuguan`, so this has to handle the origin too.
          builderReturnPage:
            page === 'suguan-builder' && s.page !== 'suguan-builder'
              ? s.page
              : null,
          // A plain navigation must not re-apply a KPI card's filtered view.
          directoryStart: null,
        })),
      navigateToDirectory: (start) =>
        set((s) => ({
          page: 'master-list',
          directoryStart: start,
          selectedSuguanId: null,
          builderSuguanId: null,
          selectedHistoryMemberId: null,
          previousPage: s.page === 'master-list' ? s.previousPage : s.page,
          builderReturnPage: null,
        })),
      clearDirectoryStart: () => set({ directoryStart: null }),
      goBack: () => {
        const { page, previousPage, navigate } = get()
        // A direct page swap (dismissing the start dialog returns to Settings
        // without going through `navigate`) can leave `previousPage` pointing at
        // the screen we are already on. Navigating there would be a no-op, so the
        // back button would appear dead. Fall back to the dashboard instead.
        navigate(previousPage && previousPage !== page ? previousPage : 'dashboard')
      },
      openSuguanDetail: (id) =>
        set({
          page: 'suguan-detail',
          selectedSuguanId: id,
          builderSuguanId: null,
          selectedHistoryMemberId: null,
          builderReturnPage: null,
          directoryStart: null,
        }),
      openMemberHistoryDetail: (memberId) =>
        set({
          page: 'members-history',
          selectedHistoryMemberId: memberId,
          selectedSuguanId: null,
          builderSuguanId: null,
          builderReturnPage: null,
          directoryStart: null,
        }),
      consumeSelectedHistoryMemberId: () => {
        const { selectedHistoryMemberId, navigate } = get()
        if (!selectedHistoryMemberId) return null
        // Re-navigating clears the flag exactly like any other plain navigation,
        // so the timeline cannot re-open itself when the user moves on and back.
        navigate('members-history')
        return selectedHistoryMemberId
      },
      startNewSuguan: () => {
        const { page } = get()
        set({
          page: 'suguan-builder',
          builderSuguanId: null,
          selectedSuguanId: null,
          selectedHistoryMemberId: null,
          // Already in the builder means this is a deliberate "start over", not a
          // jump from elsewhere, so there is no origin worth returning to.
          builderReturnPage: page === 'suguan-builder' ? null : page,
          directoryStart: null,
        })
      },
      dismissNewSuguan: () => {
        const { builderReturnPage } = get()
        if (!builderReturnPage || builderReturnPage === 'suguan-builder') {
          set({ builderReturnPage: null, directoryStart: null })
          return null
        }
        set({
          page: builderReturnPage,
          builderReturnPage: null,
          directoryStart: null,
        })
        return builderReturnPage
      },
      clearBuilderReturnPage: () => set({ builderReturnPage: null }),
      editSuguanInBuilder: (id) =>
        set({
          page: 'suguan-builder',
          builderSuguanId: id,
          selectedSuguanId: null,
          selectedHistoryMemberId: null,
          builderReturnPage: null,
          directoryStart: null,
        }),
    }),
    {
      name: 'choir-nav',
      version: 1,
      /**
       * Only the durable half of navigation survives a reload: which screen the
       * user was on, the record the Suguan detail screen was showing, and where
       * the back button came from. The one-shot flags (`directoryStart`,
       * `selectedHistoryMemberId`, `builderReturnPage`) and the builder draft id
       * are deliberately left out so a reload cannot re-open a dialog or replay
       * a stale filtered directory.
       */
      partialize: (state) => ({
        page: state.page,
        selectedSuguanId: state.selectedSuguanId,
        previousPage: state.previousPage,
      }),
      /**
       * The Suguan builder holds an in-memory draft that is not persisted, so
       * restoring `suguan-builder` would mount an empty step 0 with the start
       * dialog already dismissed. Treat an interrupted build as a fresh visit
       * and land on the dashboard, and drop `selectedSuguanId` unless the detail
       * screen is the one being restored.
       */
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<NavState>
        const page =
          saved.page && saved.page !== 'suguan-builder'
            ? saved.page
            : current.page
        return {
          ...current,
          page,
          selectedSuguanId:
            page === 'suguan-detail' ? (saved.selectedSuguanId ?? null) : null,
          previousPage: saved.previousPage ?? null,
        }
      },
    },
  ),
)
