import type { ExtraOccasionSuguanConfig, Suguan, VoicePosition } from '@/core/types/suguan'
import type { Member } from '@/core/types/member'
import { formatDateKeyNumeric } from '@/lib/phDate'
import { normalizeDocFormat, resolveFontSizePreset, resolveSignatureNames } from '@/lib/suguanUtils'
import { buildExtraOccasionSections } from './extraOccasionData'

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
  const sections = buildExtraOccasionSections(
    suguan,
    voices,
    members,
    config.organistaAssignments,
  )
  const columns = [
    config.pagsasanay.enabled ? config.pagsasanay : null,
    config.pagtupad.enabled ? config.pagtupad : null,
  ].filter((column) => column !== null)
  const signatures = resolveSignatureNames(suguan, members)
  const preset = resolveFontSizePreset(normalizeDocFormat(suguan.docFormat))

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60 bg-slate-200/60 p-3 dark:bg-slate-900/40">
      <article
        className="mx-auto min-w-[680px] bg-white p-8 text-black shadow-sm"
        style={{ fontFamily: 'Book Antiqua, Georgia, serif', fontSize: `${preset.bodyFontSize}pt` }}
      >
        <header className="mb-5 text-center">
          <p style={{ fontSize: `${preset.headerFontSize}pt` }}>
            Lokal ng {config.localeName.trim()}
          </p>
          <h2
            className="mt-1 font-bold"
            style={{ fontSize: `${preset.titleFontSize}pt` }}
          >
            EXTRA OCCASION SUGUAN
          </h2>
        </header>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/70">
              <th className="w-12 border border-gray-500 px-2 py-1">Blg.</th>
              <th className="border border-gray-500 px-2 py-1">PANGALAN</th>
              {columns.map((column) => (
                <th
                  key={column.label}
                  className="border border-gray-500 px-2 py-1"
                >
                  {column.label}
                  <br />
                  {formatDateKeyNumeric(column.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              let number = 1
              return sections.flatMap((schedule) => {
                const rows = [
                  <tr key={`${schedule.id}-schedule`} className="bg-green-100">
                    <td
                      colSpan={2 + columns.length}
                      className="border border-gray-500 px-2 py-1 text-center font-bold"
                    >
                      {schedule.label}
                    </td>
                  </tr>,
                ]
                const groups = [
                  ...schedule.voiceSections,
                  ...(schedule.organistaRows.length
                    ? [{ id: `${schedule.id}-organista`, label: 'ORGANISTA', rows: schedule.organistaRows }]
                    : []),
                ]
                for (const group of groups) {
                  rows.push(
                    <tr key={`${schedule.id}-${group.id}`}>
                      <td className="border border-gray-500 px-2 py-1" />
                      <td
                        colSpan={1 + columns.length}
                        className="border border-gray-500 px-2 py-1 font-bold"
                      >
                        {group.label}
                      </td>
                    </tr>,
                  )
                  for (const row of group.rows) {
                    rows.push(
                      <tr key={`${schedule.id}-${row.memberId}`}>
                        <td className="border border-gray-500 px-2 py-1 text-center">
                          {number++}.
                        </td>
                        <td className="border border-gray-500 px-2 py-1">{row.name}</td>
                        {columns.map((column) => (
                          <td
                            key={column.label}
                            className="border border-gray-500 px-2 py-1"
                          />
                        ))}
                      </tr>,
                    )
                  }
                }
                return rows
              })
            })()}
          </tbody>
        </table>
        {config.showFooterSignatories && (
          <footer className="mt-10 grid grid-cols-2 gap-8 text-center">
            <div>
              <p>{signatures.pmName}</p>
              <p className="mt-5 border-t border-gray-700 pt-1">Pangulong Mang-aawit</p>
            </div>
            <div>
              <p>{signatures.destinadoName}</p>
              <p className="mt-5 border-t border-gray-700 pt-1">Destinado</p>
            </div>
          </footer>
        )}
      </article>
    </div>
  )
}
