/**
 * Suguan sheet layout tests.
 *
 * These guard the invariant behind "Preview = Export PDF": both renderers read
 * their geometry from `computeSuguanLayout`, so the numbers asserted here are
 * the single source of truth for the on-screen preview, the PDF, and Excel.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSections,
  computeSuguanLayout,
  createSuguanExcelBlob,
  fitFontSizePt,
  PT_TO_MM,
  SIG_RULE_PAD,
  suguanSheetAccent,
  type SheetMembers,
} from './suguanExport.ts'
import {
  clampCustomBodyFontSize,
  CUSTOM_BODY_FONT_MAX,
  CUSTOM_BODY_FONT_MIN,
  DEFAULT_DOC_FORMAT,
  docPaperDimensionsMm,
  FONT_SIZE_PRESETS,
  normalizeDocFormat,
  resolveFontSizePreset,
  resolveSignatureNames,
  scaleFontSizePreset,
} from './suguanUtils.ts'
import type { Suguan, SuguanDocFormat } from '../core/types/suguan.ts'

const PRESETS: SuguanDocFormat[] = (['small', 'normal', 'large'] as const).map(
  (fontSize) => ({
    paperSize: 'letter' as const,
    orientation: 'landscape' as const,
    margins: 'normal' as const,
    scaling: 'fit-width' as const,
    fontSize,
  }),
)

function makeMembers(count: number): SheetMembers[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    firstName: ['Julie', 'Maria', 'Ana', 'Rosa', 'Liza', 'Grace', 'Beth', 'Ruth'][i % 8],
    lastName: ['Sales', 'Reyes', 'Cruz', 'Bautista', 'Garcia', 'Mendoza', 'Torres', 'Ramos'][
      i % 8
    ],
  }))
}

function makeSuguan(
  memberCount: number,
  docFormat?: SuguanDocFormat,
  scaling: SuguanDocFormat['scaling'] = 'fit-width',
): Suguan {
  const fmt = docFormat ? { ...docFormat, scaling } : undefined
  return {
    id: 'sg1',
    date: '2026-09-26',
    time: '18:00',
    serviceTypeId: 'svc1',
    group: 'mixed',
    docFormat: fmt ?? null,
    events: [
      { id: 'e1', type: 'pagsasanay', date: '2026-09-23', endDate: '2026-09-24' },
      { id: 'e2', type: 'pagtupad', date: '2026-09-26' },
    ],
    schedules: [],
    voiceCapacities: {},
    assignments: makeMembers(memberCount).map((m, i) => ({
      memberId: m.id,
      memberName: `${m.firstName} ${m.lastName}`,
      voicePosition: i % 2 === 0 ? 'soprano-1' : 'alto',
      assignedAt: '2026-09-20T10:00:00.000Z',
    })),
    dutyRoles: [],
    destinadoName: 'Parish Priest',
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
  } as Suguan
}

const close = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ~= ${b}`)

test('signature geometry is exposed as one shared object, not per-renderer scalars', () => {
  const layout = computeSuguanLayout(makeSuguan(12), makeMembers(12), PRESETS[1])
  const { sig } = layout
  assert.equal(sig.totalMm, sig.gapMm + sig.nameRowMm + sig.roleRowMm)
  assert.ok(sig.gapMm > 0, 'a gap between table and signatures is always reserved')
  assert.ok(sig.nameRowMm > 0)
  assert.ok(sig.roleRowMm > 0)
  assert.ok(sig.nameFontSizePt > 0)
  assert.ok(sig.roleFontSizePt > 0)
})

test('the gap above the signature block is generous at every font preset', () => {
  for (const preset of PRESETS) {
    const layout = computeSuguanLayout(makeSuguan(12, preset), makeMembers(12), preset)
    const { sig } = layout
    // At least two body rows of clear space, so signatures never read as table rows.
    assert.ok(
      sig.gapMm >= layout.bodyRowH * 1.9,
      `gap ${sig.gapMm}mm should clear at least two ${preset.fontSize} body rows`,
    )
    assert.ok(sig.gapMm > sig.nameRowMm * 0.7, 'gap must exceed the name row height')
  }
})

test('table and signature space share the available area without double counting', () => {
  for (const preset of PRESETS) {
    const layout = computeSuguanLayout(makeSuguan(12, preset), makeMembers(12), preset)
    const expected =
      layout.paperHeightMm -
      layout.margins.top -
      layout.margins.bottom -
      layout.topBlockH
    close(layout.usableTableH, expected)
    assert.ok(layout.usableTableH > 0)
    assert.ok(layout.usableTableH > layout.sig.totalMm)
  }
})

test('the last page always ends with overlay signature blocks in order', () => {
  // 60 members forces pagination, which is where the PDF previously diverged.
  for (const preset of PRESETS) {
    for (const scaling of ['fit-width', 'fit-page'] as const) {
      const suguan = makeSuguan(60, preset, scaling)
      const members = makeMembers(60)
      const layout = computeSuguanLayout(suguan, members, { ...preset, scaling })
      assert.ok(layout.pages.length > 1, 'expected this fixture to paginate')

      const last = layout.pages[layout.pages.length - 1]
      const tail = last.slice(-3).map((b) => b.kind)
      assert.deepEqual(tail, ['sig-gap', 'sig-name', 'sig-title'])

      // Every page except the last is pure table content.
      for (const page of layout.pages.slice(0, -1)) {
        assert.ok(
          page.every((b) => b.kind === 'section-label' || b.kind === 'member'),
          'only the final page carries the signature block',
        )
      }
    }
  }
})

test('legal portrait pages fit 17 members in each of three compact schedules', () => {
  const legal: SuguanDocFormat = {
    paperSize: 'legal',
    orientation: 'portrait',
    margins: 'normal',
    scaling: 'fit-width',
    fontSize: 'normal',
  }
  const members = makeMembers(51)
  const suguan = makeSuguan(51, legal)
  suguan.schedules = Array.from({ length: 3 }, (_, scheduleIndex) => ({
    id: `schedule-${scheduleIndex}`,
    scheduleLabel: `Schedule ${scheduleIndex + 1}`,
    scheduleDay: '',
    scheduleTime: '',
    assignments: suguan.assignments.slice(scheduleIndex * 17, (scheduleIndex + 1) * 17),
  }))
  const layout = computeSuguanLayout(suguan, members, legal)

  assert.equal(layout.pages.length, 2)
  assert.equal(
    layout.pages.flat().filter((block) => block.kind === 'member').length,
    57,
  )
  assert.ok(
    layout.pages.flat().filter((block) => block.kind === 'section-label').length >= 3,
  )
  assert.deepEqual(
    layout.pages.at(-1)?.slice(-3).map((block) => block.kind),
    ['sig-gap', 'sig-name', 'sig-title'],
  )
})

test('each schedule includes exactly two numbered blank write-in rows', () => {
  const members = makeMembers(3)
  const suguan = makeSuguan(3, PRESETS[1])
  suguan.schedules = [
    {
      id: 'schedule-a',
      scheduleLabel: 'Schedule A',
      scheduleDay: '',
      scheduleTime: '',
      assignments: suguan.assignments.slice(0, 1),
    },
    {
      id: 'schedule-b',
      scheduleLabel: 'Schedule B',
      scheduleDay: '',
      scheduleTime: '',
      assignments: suguan.assignments.slice(1),
    },
  ]

  const sections = buildSections(suguan, members)
  assert.deepEqual(
    sections.map((section) => section.rows.map((row) => [row.no, row.name])),
    [
      [
        [1, 'Sales, Julie'],
        [2, ''],
        [3, ''],
      ],
      [
        [1, 'Cruz, Ana'],
        [2, 'Reyes, Maria'],
        [3, ''],
        [4, ''],
      ],
    ],
  )
})

test('automatic layout preserves normal name size on supported paper sizes', () => {
  for (const paperSize of ['letter', 'a4', 'legal', 'folio'] as const) {
    const format: SuguanDocFormat = {
      paperSize,
      orientation: 'portrait',
      margins: 'normal',
      scaling: 'auto',
      fontSize: 'normal',
    }
    const members = makeMembers(51)
    const suguan = makeSuguan(51, format)
    suguan.schedules = Array.from({ length: 3 }, (_, scheduleIndex) => ({
      id: `schedule-${scheduleIndex}`,
      scheduleLabel: `Schedule ${scheduleIndex + 1}`,
      scheduleDay: '',
      scheduleTime: '',
      assignments: suguan.assignments.slice(
        scheduleIndex * 17,
        (scheduleIndex + 1) * 17,
      ),
    }))
    const layout = computeSuguanLayout(suguan, members, format)

    assert.equal(layout.scale, 1)
    assert.equal(layout.bodyFontSizePt, FONT_SIZE_PRESETS.normal.bodyFontSize)
    assert.ok(layout.pages.length >= 1, `${paperSize} should render at least one page`)
    assert.deepEqual(
      layout.pages.at(-1)?.slice(-3).map((block) => block.kind),
      ['sig-gap', 'sig-name', 'sig-title'],
    )
  }
})

test('automatic layout paginates large rosters instead of shrinking member names', () => {
  const format: SuguanDocFormat = {
    paperSize: 'letter',
    orientation: 'portrait',
    margins: 'normal',
    scaling: 'auto',
    fontSize: 'normal',
  }
  const members = makeMembers(150)
  const layout = computeSuguanLayout(makeSuguan(150, format), members, format)

  assert.equal(layout.scale, 1)
  assert.equal(layout.bodyFontSizePt, FONT_SIZE_PRESETS.normal.bodyFontSize)
  assert.ok(layout.pages.length > 1)
  const lastPage = layout.pages[layout.pages.length - 1]
  assert.ok(lastPage.some((block) => block.kind === 'member'))
  assert.deepEqual(
    lastPage.slice(-3).map((block) => block.kind),
    ['sig-gap', 'sig-name', 'sig-title'],
  )
})

test('signature column centres sit at the quarter and three-quarter marks', () => {
  for (const preset of PRESETS) {
    const layout = computeSuguanLayout(makeSuguan(12, preset), makeMembers(12), preset)
    const { sig } = layout
    close(sig.columnWidthMm, sig.tableWidthMm / 2)
    close(sig.leftCenterMm, sig.tableWidthMm * 0.25)
    close(sig.rightCenterMm, sig.tableWidthMm * 0.75)
  }
})

test('name and role text land inside their own rows', () => {
  for (const preset of PRESETS) {
    const layout = computeSuguanLayout(makeSuguan(12, preset), makeMembers(12), preset)
    const { sig } = layout
    // Name is centred vertically, and its rule sits below the text.
    close(sig.nameCenterMm, sig.nameRowMm / 2)
    assert.ok(sig.ruleOffsetMm > 0, 'the rule must sit below the name')
    // The rule must not spill past the bottom of the name row.
    assert.ok(sig.nameCenterMm + sig.ruleOffsetMm <= sig.nameRowMm)
    // Role text starts at the top of the role row, matching the PDF baseline.
    assert.ok(sig.roleCenterMm > 0 && sig.roleCenterMm < sig.roleRowMm)
  }
})

test('fit-page preserves member-name font size and shared signature geometry', () => {
  const wide = computeSuguanLayout(makeSuguan(60, PRESETS[1], 'fit-width'), makeMembers(60), {
    ...PRESETS[1],
    scaling: 'fit-width',
  })
  const fit = computeSuguanLayout(makeSuguan(60, PRESETS[1], 'fit-page'), makeMembers(60), {
    ...PRESETS[1],
    scaling: 'fit-page',
  })
  assert.equal(wide.scale, 1, 'fit-width must not scale')
  assert.equal(fit.scale, 1, 'the sheet should paginate instead of shrinking text')
  assert.deepEqual(wide.sig, fit.sig)
  assert.equal(fit.bodyFontSizePt, wide.bodyFontSizePt)
})

test('large font size only increases names while other Choir Suguan text stays normal', () => {
  const normal = computeSuguanLayout(makeSuguan(60, PRESETS[1]), makeMembers(60), PRESETS[1])
  const large = computeSuguanLayout(makeSuguan(60, PRESETS[2]), makeMembers(60), PRESETS[2])

  assert.ok(large.bodyFontSizePt > normal.bodyFontSizePt)
  assert.ok(large.nameFontSize > normal.nameFontSize)
  assert.equal(large.fs.titleFontSize, normal.fs.titleFontSize)
  assert.equal(large.fs.headerFontSize, normal.fs.headerFontSize)
  assert.equal(large.sig.nameFontSizePt, normal.sig.nameFontSizePt)
  assert.ok(large.bodyRowH > normal.bodyRowH)
  assert.equal(large.scale, 1)
})

test('fit-page leaves the selected member-name size unchanged', () => {
  const members = makeMembers(60)
  const layout = computeSuguanLayout(makeSuguan(60, PRESETS[1], 'fit-page'), members, {
    ...PRESETS[1],
    scaling: 'fit-page',
  })
  assert.equal(layout.scale, 1)
  assert.equal(layout.bodyFontSizePt, layout.nameFontSize)
})

test('Extra Occasion keeps the selected name font size and paginates instead of shrinking it', () => {
  const members = makeMembers(60)
  const makeExtraOccasion = (fontSize: SuguanDocFormat['fontSize']) => {
    const suguan = makeSuguan(60, {
      ...PRESETS[fontSize === 'large' ? 2 : 1],
      scaling: 'fit-page',
    })
    suguan.extraOccasion = { name: 'Kasal' } as NonNullable<Suguan['extraOccasion']>
    return suguan
  }
  const normal = computeSuguanLayout(makeExtraOccasion('normal'), members, {
    ...PRESETS[1],
    scaling: 'fit-page',
  })
  const large = computeSuguanLayout(makeExtraOccasion('large'), members, {
    ...PRESETS[2],
    scaling: 'fit-page',
  })

  assert.equal(normal.scale, 1)
  assert.equal(large.scale, 1)
  assert.equal(large.bodyFontSizePt, large.nameFontSize)
  assert.ok(large.bodyFontSizePt > normal.bodyFontSizePt)
  assert.ok(large.pages.length > 1, 'oversized rosters should paginate')
})

test('fitFontSizePt shrinks only as far as needed and never below the floor', () => {
  const wide = () => 0.5 * 100
  const narrow = () => 0.5 * 10
  assert.equal(fitFontSizePt({ text: 'a', startSizePt: 12, maxWidthMm: 100, measureMm: narrow }), 12)
  assert.equal(
    fitFontSizePt({ text: 'a', startSizePt: 12, maxWidthMm: 3, measureMm: wide, minSizePt: 6 }),
    6,
  )
  // Monotonic: a looser bound never produces a smaller size.
  const loose = fitFontSizePt({ text: 'Julie Anne Sales', startSizePt: 12, maxWidthMm: 60, measureMm: wide })
  const tight = fitFontSizePt({ text: 'Julie Anne Sales', startSizePt: 12, maxWidthMm: 30, measureMm: wide })
  assert.ok(tight <= loose)
})

test('a signature name is never squeezed below the column it must fit', () => {
  const layout = computeSuguanLayout(makeSuguan(12, PRESETS[1]), makeMembers(12), PRESETS[1])
  const sizePt = fitFontSizePt({
    text: 'A Very Long Signature Name Indeed',
    startSizePt: layout.sig.nameFontSizePt,
    maxWidthMm: layout.sig.columnWidthMm - 2 * SIG_RULE_PAD,
    // 0.5mm per point of font size
    measureMm: (_t, s) => s * 0.5,
  })
  const widthMm = sizePt * 0.5
  assert.ok(widthMm <= layout.sig.columnWidthMm - 2 * SIG_RULE_PAD)
})

test('an empty roster still lays out a full page without a phantom gap', () => {
  const layout = computeSuguanLayout(makeSuguan(0), [], PRESETS[1])
  assert.equal(layout.rowCount, 2)
  assert.ok(layout.sig.gapMm > 0)
  assert.equal(layout.pages.length, 1)
  const tail = layout.pages[0].slice(-3).map((b) => b.kind)
  assert.deepEqual(tail, ['sig-gap', 'sig-name', 'sig-title'])
})

test('Folio is the default paper size and font size remains normal', () => {
  assert.equal(DEFAULT_DOC_FORMAT.paperSize, 'folio')
  assert.equal(normalizeDocFormat(undefined).paperSize, 'folio')
  assert.deepEqual(docPaperDimensionsMm(DEFAULT_DOC_FORMAT), {
    width: 215.9,
    height: 330.2,
  })
  const defaultLayout = computeSuguanLayout(makeSuguan(0), [])
  assert.equal(defaultLayout.paperWidthMm, 215.9)
  assert.equal(defaultLayout.paperHeightMm, 330.2)
  assert.equal(DEFAULT_DOC_FORMAT.fontSize, 'normal')
  assert.equal(FONT_SIZE_PRESETS.normal.bodyFontSize, 9)
  assert.ok(FONT_SIZE_PRESETS.normal.bodyFontSize > FONT_SIZE_PRESETS.small.bodyFontSize)
  assert.ok(FONT_SIZE_PRESETS.large.bodyFontSize > FONT_SIZE_PRESETS.normal.bodyFontSize)
  // Every preset must stay in ascending order or the picker stops meaning anything.
  assert.ok(FONT_SIZE_PRESETS.small.bodyFontSize < FONT_SIZE_PRESETS.normal.bodyFontSize)
})

test('table paragraph spacing changes name rows but not headers, title, or signatures', () => {
  const suguan = makeSuguan(100)
  const members = makeMembers(100)
  const normal = computeSuguanLayout(suguan, members)
  const spacedFormat = normalizeDocFormat({
    ...DEFAULT_DOC_FORMAT,
    tableSpacingBeforePt: 2,
    tableSpacingAfterPt: 3,
  })
  const spaced = computeSuguanLayout(suguan, members, spacedFormat)
  const addedSpacingMm = 5 * PT_TO_MM

  assert.equal(spaced.headerRowH, normal.headerRowH)
  assert.equal(spaced.sectionLabelRowH, normal.sectionLabelRowH)
  assert.ok(Math.abs(spaced.bodyRowH - normal.bodyRowH - addedSpacingMm) < 1e-9)
  assert.equal(spaced.titleRowH, normal.titleRowH)
  assert.equal(spaced.sig.totalMm, normal.sig.totalMm)
  assert.equal(spaced.scale, normal.scale)
  assert.equal(spaced.bodyFontSizePt, normal.bodyFontSizePt)
})

test('table paragraph spacing is non-negative, finite, and capped', () => {
  assert.equal(normalizeDocFormat({ tableSpacingBeforePt: -4 }).tableSpacingBeforePt, 0)
  assert.equal(normalizeDocFormat({ tableSpacingBeforePt: Infinity }).tableSpacingBeforePt, 0)
  assert.equal(normalizeDocFormat({ tableSpacingAfterPt: 100 }).tableSpacingAfterPt, 72)
})

test('Excel applies before-and-after spacing to name rows only', async () => {
  const format = normalizeDocFormat({
    ...DEFAULT_DOC_FORMAT,
    tableSpacingBeforePt: 2,
    tableSpacingAfterPt: 3,
  })
  const blob = await createSuguanExcelBlob(makeSuguan(1), makeMembers(1), format)
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await blob.arrayBuffer())
  const sheet = workbook.worksheets[0]

  assert.equal(sheet.getRow(2).height, 16)
  assert.equal(sheet.getRow(4).height, 16)
  assert.equal(
    sheet.getRow(5).height,
    format.tableSpacingBeforePt! + format.tableSpacingAfterPt! + 14,
  )
})

test('Excel keeps non-name text normal and preserves larger names across pages', async () => {
  const format: SuguanDocFormat = {
    ...PRESETS[2],
    scaling: 'fit-page',
  }
  const blob = await createSuguanExcelBlob(makeSuguan(60, format), makeMembers(60), format)
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await blob.arrayBuffer())
  const sheet = workbook.worksheets[0]

  assert.equal(sheet.getCell('A1').font.size, FONT_SIZE_PRESETS.normal.titleFontSize)
  assert.equal(sheet.getCell('B4').font.size, FONT_SIZE_PRESETS.normal.headerFontSize)
  assert.equal(sheet.getCell('A5').font.size, FONT_SIZE_PRESETS.normal.bodyFontSize)
  assert.equal(sheet.getCell('B5').font.size, FONT_SIZE_PRESETS.large.bodyFontSize)
  assert.equal(sheet.pageSetup.fitToHeight, 0)
})

test('Excel export uses the Folio print paper size', async () => {
  const blob = await createSuguanExcelBlob(makeSuguan(0), [])
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await blob.arrayBuffer())

  assert.equal(workbook.worksheets[0].pageSetup.paperSize, 14)
})

test('a custom body size is clamped and rounded to a half point', () => {
  assert.equal(clampCustomBodyFontSize(undefined), FONT_SIZE_PRESETS.normal.bodyFontSize)
  assert.equal(clampCustomBodyFontSize(NaN), FONT_SIZE_PRESETS.normal.bodyFontSize)
  assert.equal(clampCustomBodyFontSize('not a number'), FONT_SIZE_PRESETS.normal.bodyFontSize)
  assert.equal(clampCustomBodyFontSize(2), CUSTOM_BODY_FONT_MIN)
  assert.equal(clampCustomBodyFontSize(400), CUSTOM_BODY_FONT_MAX)
  assert.equal(clampCustomBodyFontSize(11.3), 11.5)
  assert.equal(clampCustomBodyFontSize(12), 12)
})

test('resolveFontSizePreset derives custom from the body size, never undefined', () => {
  const custom = resolveFontSizePreset(
    normalizeDocFormat({ ...DEFAULT_DOC_FORMAT, fontSize: 'custom', customBodyFontSize: 14 }),
  )
  assert.equal(custom.bodyFontSize, 14)
  assert.ok(custom.titleFontSize > custom.bodyFontSize, 'the title stays larger than the body')
  assert.ok(custom.sigFontSize > custom.bodyFontSize)
  // A cleared custom input must fall back rather than produce a zero-size sheet.
  const cleared = resolveFontSizePreset(
    normalizeDocFormat({ ...DEFAULT_DOC_FORMAT, fontSize: 'custom' }),
  )
  assert.equal(cleared.bodyFontSize, FONT_SIZE_PRESETS.normal.bodyFontSize)
})

test('scaling a preset keeps row heights ahead of the text they contain', () => {
  // The failure this guards: a bigger font in an unchanged row, so names clip.
  for (const body of [6, 8, 10, 14, 18, CUSTOM_BODY_FONT_MAX]) {
    const fs = scaleFontSizePreset(FONT_SIZE_PRESETS.normal, body)
    assert.equal(fs.bodyFontSize, body)
    assert.ok(fs.rowHeight >= fs.bodyFontSize * 1.2, `row too short at ${body}pt`)
    assert.ok(fs.headerRowHeight >= fs.headerFontSize * 1.2, `header row too short at ${body}pt`)
    assert.ok(fs.sigRowHeight >= fs.sigFontSize * 1.2, `sig row too short at ${body}pt`)
    assert.ok(fs.titleRowHeight >= fs.titleFontSize * 1.5, `title row too short at ${body}pt`)
    // A larger body never yields a smaller row, or scaling would not be monotonic.
    if (body > FONT_SIZE_PRESETS.normal.bodyFontSize) {
      assert.ok(fs.rowHeight > FONT_SIZE_PRESETS.normal.rowHeight)
    }
  }
})

test('a custom font size reaches both renderers through the shared layout', () => {
  const custom: SuguanDocFormat = {
    paperSize: 'letter',
    orientation: 'landscape',
    margins: 'normal',
    scaling: 'fit-width',
    fontSize: 'custom',
    customBodyFontSize: 16,
  }
  const layout = computeSuguanLayout(makeSuguan(12, custom), makeMembers(12), custom)
  assert.equal(layout.fs.bodyFontSize, FONT_SIZE_PRESETS.normal.bodyFontSize)
  assert.equal(layout.nameFontSize, 16)
  assert.equal(layout.bodyFontSizePt, 16)
  assert.equal(layout.fs.titleFontSize, FONT_SIZE_PRESETS.normal.titleFontSize)
  assert.ok(layout.bodyRowH > 0)
  assert.ok(layout.rowsPerPage > 0)
  assert.ok(layout.usableTableH > 0)
  assert.ok(layout.sig.nameFontSizePt > 0)
  // Bigger type must mean fewer rows on the page, not the same count.
  const normal = computeSuguanLayout(makeSuguan(12, PRESETS[1]), makeMembers(12), PRESETS[1])
  assert.ok(layout.rowsPerPage < normal.rowsPerPage, '16pt should fit fewer rows than normal')
})

test('sheet accent fills follow the choir: green women, blue men, gold mixed', () => {
  assert.deepEqual(suguanSheetAccent('babae'), {
    scheduleFill: '#C6EFCE',
    pagtupadFill: '#D9EAD3',
  })
  assert.deepEqual(suguanSheetAccent('lalaki'), {
    scheduleFill: '#C2E1FA',
    pagtupadFill: '#D2E6F8',
  })
  assert.deepEqual(suguanSheetAccent('mixed'), {
    scheduleFill: '#F8E7C0',
    pagtupadFill: '#FAF0D8',
  })
})

test('the OIC duty holder is marked "- OIC" on their sheet row', () => {
  const members = makeMembers(4)
  const suguan = makeSuguan(4, PRESETS[1])
  suguan.dutyRoles = [
    { dutyRoleId: 'oic', memberId: 'm1', memberName: 'Maria Reyes' },
  ]
  const names = buildSections(suguan, members).flatMap((s) =>
    s.rows.map((r) => r.name),
  )
  assert.ok(
    names.includes('Reyes, Maria - OIC'),
    'the OIC member should read "Reyes, Maria - OIC"',
  )
  assert.equal(names.filter((n) => n.includes(' - OIC')).length, 1)
})

test('without an OIC duty role no " - OIC" marker appears', () => {
  const members = makeMembers(3)
  const names = buildSections(makeSuguan(3, PRESETS[1]), members).flatMap((s) =>
    s.rows.map((r) => r.name),
  )
  assert.ok(!names.some((n) => n.includes(' - OIC')))
})

test('the signature Pangulong comes from the master list, not a duty role', () => {
  const dutyRoles = [
    {
      id: 'Ccuo8FLgJo4lgfK19ildr',
      name: 'Pangulong Mang-aawit',
      abbreviation: 'PM',
    },
  ]
  const suguan = makeSuguan(2, PRESETS[1])
  suguan.dutyRoles = [
    {
      dutyRoleId: 'pangulong-mang-aawit',
      memberId: 'm0',
      memberName: 'Jose Santos',
    },
  ]
  // A legacy stored position counts once a configured role carries its name.
  const { pmName } = resolveSignatureNames(
    suguan,
    [
      {
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        isActive: true,
        positions: ['pangulong-mang-aawit'],
      },
    ],
    dutyRoles,
  )
  assert.equal(pmName, 'Juan Dela Cruz')

  // An assigned duty role with a configured (nanoid) id works the same way.
  const { pmName: assigned } = resolveSignatureNames(
    suguan,
    [
      {
        firstName: 'Maria',
        lastName: 'Reyes',
        isActive: true,
        assignedDutyRoleIds: ['Ccuo8FLgJo4lgfK19ildr'],
      },
    ],
    dutyRoles,
  )
  assert.equal(assigned, 'Maria Reyes')

  // With no member holding the rank, the legacy stored duty role is the fallback.
  const { pmName: legacyFallback } = resolveSignatureNames(suguan, [], dutyRoles)
  assert.equal(legacyFallback, 'Jose Santos')

  // And with neither, the signature is blank.
  const { pmName: fallback } = resolveSignatureNames(
    { ...suguan, dutyRoles: [] },
    [],
    dutyRoles,
  )
  assert.equal(fallback, '')
})
