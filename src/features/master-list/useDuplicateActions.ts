import { toast } from 'sonner'
import type { Member } from '@/core/types/member'
import { useMemberStore } from '@/store/memberStore'
import { useAuthStore } from '@/store/authStore'
import { useNavStore } from '@/store/navStore'
import { todayPHT } from '@/lib/phDate'
import { formatMemberName } from '@/lib/memberDirectory'

/**
 * The three things the duplicate panel can do with a matched member, shared by
 * the desktop and mobile Add Member forms so their behaviours cannot drift.
 */
export function useDuplicateActions(onFormClosed: () => void) {
  const restoreMember = useMemberStore((s) => s.restoreMember)
  const currentAccountId = useAuthStore((s) => s.currentAccountId)
  const openMemberHistoryDetail = useNavStore((s) => s.openMemberHistoryDetail)

  const viewHistory = (member: Member) => {
    onFormClosed()
    // Swaps the page to Members History and opens this member's timeline.
    openMemberHistoryDetail(member.id)
  }

  // Restores with today as the return date. The user can adjust it later from
  // the timeline's edit controls.
  const restore = (member: Member) => {
    const accountId = currentAccountId ?? ''
    const result = restoreMember(accountId, member.id, {
      date: todayPHT(),
    })
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(
      `${formatMemberName(member)} restored to the Master List.`,
    )
    onFormClosed()
    openMemberHistoryDetail(member.id)
  }

  return { viewHistory, restore }
}