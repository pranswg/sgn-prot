import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { KoroDocument } from '@/core/types/koro'
import { createKoroDocument } from '@/lib/koro'

interface KoroState {
  documents: KoroDocument[]
  activeDocumentId: string
  createDocument: () => string
  selectDocument: (id: string) => void
  updateDocument: (id: string, patch: Partial<Omit<KoroDocument, 'id'>>) => void
  deleteDocument: (id: string) => void
  reset: () => void
}

export const useKoroStore = create<KoroState>()(
  persist(
    (set, get) => {
      return {
        documents: [],
        activeDocumentId: '',

        createDocument: () => {
          const document = createKoroDocument()
          set((state) => ({
            documents: [...state.documents, document],
            activeDocumentId: document.id,
          }))
          return document.id
        },

        selectDocument: (id) => {
          if (get().documents.some((document) => document.id === id)) {
            set({ activeDocumentId: id })
          }
        },

        updateDocument: (id, patch) => {
          set((state) => ({
            documents: state.documents.map((document) =>
              document.id === id
                ? { ...document, ...patch, updatedAt: new Date().toISOString() }
                : document,
            ),
          }))
        },

        deleteDocument: (id) => {
          set((state) => {
            const documents = state.documents.filter((document) => document.id !== id)
            return {
              documents,
              activeDocumentId:
                state.activeDocumentId === id
                  ? documents[0]?.id ?? ''
                  : state.activeDocumentId,
            }
          })
        },

        reset: () => set({ documents: [], activeDocumentId: '' }),
      }
    },
    {
      name: 'choir-koro-documents',
      version: 1,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<KoroState>
        const documents = Array.isArray(state.documents) ? state.documents : []
        const activeDocumentId = documents.some(
          (document) => document.id === state.activeDocumentId,
        )
          ? state.activeDocumentId!
          : documents[0]?.id ?? ''
        return { documents, activeDocumentId }
      },
    },
  ),
)
