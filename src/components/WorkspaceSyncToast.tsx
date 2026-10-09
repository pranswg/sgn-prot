import { useEffect } from 'react'
import { toast } from 'sonner'
import { useWorkspaceStore } from '@/store/workspaceStore'

/**
 * Surfaces a failed Postgres sync as a persistent toast with a retry. The retry
 * pushes this browser's current state back up, which recovers whichever write
 * did not land.
 */
export function WorkspaceSyncToast() {
  const error = useWorkspaceStore((state) => state.error)
  const uploadBrowserData = useWorkspaceStore((state) => state.uploadBrowserData)

  useEffect(() => {
    if (!error) {
      toast.dismiss('workspace-sync')
      return
    }
    toast.error('Changes could not be saved', {
      id: 'workspace-sync',
      description: error,
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: 'Retry',
        onClick: () => {
          void uploadBrowserData()
        },
      },
    })
  }, [error, uploadBrowserData])

  return null
}
