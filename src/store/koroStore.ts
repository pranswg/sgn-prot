import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { KoroDocument } from '@/core/types/koro'
import { deleteRow, upsertRow } from '@/api/db'
import { persist as persistWrite } from '@/lib/writeThrough'
import { createKoroDocument } from '@/lib/koro'

interface KoroState {
  documents: KoroDocument[]
  activeDocumentId: string
  importData: (documents: KoroDocument[]) => void
  createDocument: () => string
  selectDocument: (id: string) => void
  updateDocument: (id: string, patch: Partial<Omit<KoroDocument, 'id'>>) => void
  deleteDocument: (id: string) => void
}

export const useKoroStore = create<KoroState>()(
  persist(
    (set, get) => {
      const initialDocument = createKoroDocument()
      return {
        documents: [initialDocument],
        activeDocumentId: initialDocument.id,

        /**
         * Phase 4d hydration. Koro always keeps at least one document, so an
         * empty server read leaves the locally seeded document in place rather
         * than emptying the maker.
         */
        importData: (documents) => {
          const list = Array.isArray(documents) ? documents : []
          if (list.length === 0) return
          set((state) => ({
            documents: list,
            activeDocumentId: list.some((d) => d.id === state.activeDocumentId)
              ? state.activeDocumentId
              : list[0].id,
          }))
        },

        createDocument: () => {
          const previous = get().documents
          const document = createKoroDocument()
          set((state) => ({
            documents: [...state.documents, document],
            activeDocumentId: document.id,
          }))
          persistWrite({
            write: upsertRow('koro_documents', document.id, document),
            rollback: () => set({ documents: previous }),
            failure: 'Could not save the new document. It was not added.',
          })
          return document.id
        },

        // Selecting a document is pure UI state; it is never written server-side.
        selectDocument: (id) => {
          if (get().documents.some((document) => document.id === id)) {
            set({ activeDocumentId: id })
          }
        },

        updateDocument: (id, patch) => {
          const previous = get().documents
          const existing = previous.find((document) => document.id === id)
          if (!existing) return
          const next: KoroDocument = {
            ...existing,
            ...patch,
            updatedAt: new Date().toISOString(),
          }
          set((state) => ({
            documents: state.documents.map((document) =>
              document.id === id ? next : document,
            ),
          }))
          persistWrite({
            write: upsertRow('koro_documents', next.id, next),
            rollback: () => set({ documents: previous }),
            failure: 'Could not save the document. Your change was reverted.',
          })
        },

        deleteDocument: (id) => {
          const previous = get().documents
          const previousActiveId = get().activeDocumentId
          const remaining = previous.filter((document) => document.id !== id)
          // The maker always needs a document to show; deleting the last one
          // replaces it with a fresh blank, which also has to be persisted.
          const replacement = remaining.length === 0 ? createKoroDocument() : null
          const documents = replacement ? [replacement] : remaining
          const activeDocumentId =
            previousActiveId === id ? documents[0].id : previousActiveId
          set({ documents, activeDocumentId })
          const writes = [deleteRow('koro_documents', id)]
          if (replacement) {
            writes.push(upsertRow('koro_documents', replacement.id, replacement))
          }
          persistWrite({
            write: writes,
            rollback: () =>
              set({ documents: previous, activeDocumentId: previousActiveId }),
            failure: 'Could not delete the document. It was restored.',
          })
        },
      }
    },
    {
      name: 'choir-koro-documents',
      version: 1,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<KoroState>
        const documents = Array.isArray(state.documents) ? state.documents : []
        const initial = documents[0] ?? createKoroDocument()
        const activeDocumentId = documents.some(
          (document) => document.id === state.activeDocumentId,
        )
          ? state.activeDocumentId!
          : initial.id
        return {
          documents: documents.length > 0 ? documents : [initial],
          activeDocumentId,
        }
      },
    },
  ),
)
