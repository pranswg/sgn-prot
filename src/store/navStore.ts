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
  navigate: (page: Page) => void
  openSuguanDetail: (id: string) => void
  startNewSuguan: () => void
  editSuguanInBuilder: (id: string) => void
}

export const useNavStore = create<NavState>()((set) => ({
  page: 'dashboard',
  selectedSuguanId: null,
  builderSuguanId: null,
  navigate: (page) => set({ page, selectedSuguanId: null, builderSuguanId: null }),
  openSuguanDetail: (id) =>
    set({ page: 'suguan-detail', selectedSuguanId: id, builderSuguanId: null }),
  startNewSuguan: () =>
    set({ page: 'suguan-builder', builderSuguanId: null, selectedSuguanId: null }),
  editSuguanInBuilder: (id) =>
    set({ page: 'suguan-builder', builderSuguanId: id, selectedSuguanId: null }),
}))