import type {
  ExtraOccasionSuguanConfig,
  Suguan,
  VoicePosition,
} from '@/core/types/suguan'
import type { Member } from '@/core/types/member'
import { SuguanSheetPreview } from '@/features/suguan-builder/SuguanSheetPreview'
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
  const sheetSuguan = buildExtraOccasionSheetSuguan(
    suguan,
    voices,
    members,
    config,
  )

  return (
    <SuguanSheetPreview
      suguan={sheetSuguan}
      members={members}
      docFormat={suguan.docFormat}
      previewWidth={900}
    />
  )
}
