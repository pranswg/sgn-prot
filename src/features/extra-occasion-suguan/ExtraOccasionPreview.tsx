import type {
  ExtraOccasionSuguanConfig,
  Suguan,
  VoicePosition,
} from '@/core/types/suguan'
import type { Member } from '@/core/types/member'
import { SuguanSheetPreview } from '@/features/suguan-builder/SuguanSheetPreview'
import { useSettingsStore } from '@/store/settingsStore'
import { buildExtraOccasionSheetSuguan } from './extraOccasionData'

interface ExtraOccasionPreviewProps {
  suguan: Suguan
  config: ExtraOccasionSuguanConfig
  members: Member[]
  voices: VoicePosition[]
}

export function ExtraOccasionPreview({
  suguan,
  config,
  members,
  voices,
}: ExtraOccasionPreviewProps) {
  const dutyRoles = useSettingsStore((state) => state.dutyRoles)
  const sheetSuguan = buildExtraOccasionSheetSuguan(
    suguan,
    voices,
    members,
    config,
    dutyRoles,
  )

  return (
    <SuguanSheetPreview
      suguan={sheetSuguan}
      members={members}
      docFormat={suguan.docFormat}
    />
  )
}
