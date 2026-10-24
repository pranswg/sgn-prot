import assert from 'node:assert/strict'
import test from 'node:test'
import {
  exportFileName,
  extraOccasionExportDocumentName,
  masterListExportDocumentName,
  masterListExportGroupLabel,
  sanitizeExportName,
  suguanExportGroupLabel,
} from './exportNaming.ts'

test('exportFileName builds `{timestamp} - {name}.{ext}`', () => {
  assert.equal(
    exportFileName('Women Choir Suguan', 'pdf', '20261008_07-00PM'),
    '20261008_07-00PM - Women Choir Suguan.pdf',
  )
})

test('exportFileName uppercases and dedots the extension', () => {
  assert.equal(
    exportFileName('Master List', '.xlsx', '20261008_07-00PM'),
    '20261008_07-00PM - Master List.xlsx',
  )
  assert.equal(
    exportFileName('Audit Logs', 'JSON', '20261008_07-00PM'),
    '20261008_07-00PM - Audit Logs.json',
  )
})

test('exportFileName defaults the timestamp to the PHT stamp', () => {
  const name = exportFileName('Trainees List', 'pdf')
  assert.match(name, /^\d{8}_\d{2}-\d{2}[AP]M - Trainees List\.pdf$/)
})

test('Extra Occasion export names use the occasion name', () => {
  assert.equal(extraOccasionExportDocumentName('Kasal'), 'Kasal Suguan')
  assert.equal(extraOccasionExportDocumentName('  '), 'Extra Occasion Suguan')
})

test('sanitizeExportName strips characters a file system rejects', () => {
  assert.equal(
    sanitizeExportName('Sunday: Pagsamba "7PM" <live> / feat? *9*'),
    'Sunday Pagsamba 7PM live feat 9',
  )
  assert.equal(sanitizeExportName('  spaced   out  '), 'spaced out')
})

test('suguanExportGroupLabel maps the Choirmen groups to English words', () => {
  assert.equal(suguanExportGroupLabel('babae'), 'Women Choir')
  assert.equal(suguanExportGroupLabel('lalaki'), 'Men Choir')
  assert.equal(suguanExportGroupLabel('mixed'), 'Mixed Choir')
})

test('masterListExportGroupLabel leaves the full roster unlabelled', () => {
  assert.equal(masterListExportGroupLabel('all'), '')
  assert.equal(masterListExportGroupLabel('female'), 'Women Choir')
  assert.equal(masterListExportGroupLabel('male'), 'Men Choir')
})

test('masterListExportDocumentName names the master list document', () => {
  assert.equal(masterListExportDocumentName('all'), 'AWS Master List')
  assert.equal(
    masterListExportDocumentName('female'),
    'AWS Women Choir Master List',
  )
  assert.equal(masterListExportDocumentName('male'), 'AWS Men Choir Master List')
})

test('masterListExportDocumentName tags the PNK choir', () => {
  assert.equal(masterListExportDocumentName('all', 'pnk'), 'PNK Master List')
  assert.equal(
    masterListExportDocumentName('female', 'pnk'),
    'PNK Women Choir Master List',
  )
})