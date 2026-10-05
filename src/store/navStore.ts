import { create } from 'zustand'

export type Page =
  | 'dashboard'
  | 'master-list'
  | 'trainees'
  | 'suguan-builder'
  | 'suguan-history'
  | 'suguan-detail'
  | 'settings'

interface NavState {
  page: Page
  selectedSuguanId: string | null
  builderSuguanId: string | null
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
  openSuguanDetail: (id: string) => void
  startNewSuguan: () => void
  /** Returns to `builderReturnPage`, or `null` if there is nowhere to go back to. */
  dismissNewSuguan: () => Page | null
  /** Forgets the remembered return page once the user has committed to a draft. */
  clearBuilderReturnPage: () => void
  editSuguanInBuilder: (id: string) => void
}

export const useNavStore = create<NavState>()((set, get) => ({
  page: 'dashboard',
  selectedSuguanId: null,
  builderSuguanId: null,
  builderReturnPage: null,
  previousPage: null,
  navigate: (page) =>
    set((s) => ({
      page,
      selectedSuguanId: null,
      builderSuguanId: null,
      // Tapping the page you are already on leaves the back destination alone,
      // so a repeated tap on Settings cannot point the back button at itself.
      previousPage: s.page === page ? s.previousPage : s.page,
      // Entering the builder from anywhere records where the user was, so
      // dismissing the start dialog can send them back. The sidebar, the mobile
      // bottom nav, and the breadcrumb all route through here, not through
      // `startNewSuguan`, so this has to handle the origin too.
      builderReturnPage:
        page === 'suguan-builder' && s.page !== 'suguan-builder' ? s.page : null,
    })),
  goBack: () => {
    const { previousPage, navigate } = get()
    navigate(previousPage ?? 'dashboard')
  },
  openSuguanDetail: (id) =>
    set({
      page: 'suguan-detail',
      selectedSuguanId: id,
      builderSuguanId: null,
      builderReturnPage: null,
    }),
  startNewSuguan: () => {
    const { page } = get()
    set({
      page: 'suguan-builder',
      builderSuguanId: null,
      selectedSuguanId: null,
      // Already in the builder means this is a deliberate "start over", not a
      // jump from elsewhere, so there is no origin worth returning to.
      builderReturnPage: page === 'suguan-builder' ? null : page,
    })
  },
  dismissNewSuguan: () => {
    const { builderReturnPage } = get()
    if (!builderReturnPage || builderReturnPage === 'suguan-builder') {
      set({ builderReturnPage: null })
      return null
    }
    set({ page: builderReturnPage, builderReturnPage: null })
    return builderReturnPage
  },
  clearBuilderReturnPage: () => set({ builderReturnPage: null }),
  editSuguanInBuilder: (id) =>
    set({
      page: 'suguan-builder',
      builderSuguanId: id,
      selectedSuguanId: null,
      builderReturnPage: null,
    }),
}))