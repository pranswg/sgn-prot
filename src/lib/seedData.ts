import type { Member, Trainee } from '@/core/types/member'
import type { Suguan } from '@/core/types/suguan'

type VoiceId = 'soprano-1' | 'soprano-2' | 'alto' | 'tenor' | 'bass'

const DATE_ADDED = '2026-09-14'
const VOICE_GENDER: Record<VoiceId, 'male' | 'female'> = {
  'soprano-1': 'female',
  'soprano-2': 'female',
  alto: 'female',
  tenor: 'male',
  bass: 'male',
}

export function seedMembers(): Member[] {
  let n = 0
  const m = (
    lastName: string,
    firstName: string,
    voicePosition: VoiceId,
    opts: { inactive?: boolean; notes?: string } = {},
  ): Member => {
    n += 1
    return {
      id: `m-${String(n).padStart(3, '0')}`,
      firstName,
      lastName,
      gender: VOICE_GENDER[voicePosition],
      voicePosition,
      membershipType: 'regular',
      isActive: !opts.inactive,
      dateAdded: DATE_ADDED,
      notes: opts.notes,
    }
  }

  return [
    // ── Soprano 1 ────────────────────────────────────────────────
    m('Daco', 'Sandreah Rose', 'soprano-1', { notes: 'PNK Kat uwang (Panguluhan)' }),
    m('Dela Cruz', 'Jaevee Almiza', 'soprano-1', { notes: 'TSV Lead (Panguluhan)' }),
    m('Didal', 'Erika', 'soprano-1', { inactive: true }),
    m('Parangue', 'Marian', 'soprano-1'),
    m('Reyes', 'Ivy Michelle', 'soprano-1', { notes: 'PNK Kat uwang (Panguluhan)' }),
    m('Reyes', 'Rhiane Shane', 'soprano-1'),
    m('Tabang', 'Princess Dorie', 'soprano-1'),

    // ── Soprano 2 ────────────────────────────────────────────────
    m('Andao', 'Kimberly', 'soprano-2'),
    m('Arancillo', 'Kim', 'soprano-2'),
    m('Bautista', 'Sarah Jean', 'soprano-2'),
    m('Biolango', 'Sylvanny', 'soprano-2'),
    m('Cañete', 'Sophia', 'soprano-2'),
    m('Corpuz', 'Enalyn', 'soprano-2'),
    m('Dalendeg', 'Lyka', 'soprano-2', { inactive: true }),
    m('Demesa', 'Delna', 'soprano-2'),
    m('Desamparado', 'Liezel Joy', 'soprano-2'),
    m('España', 'Marimar', 'soprano-2', { notes: 'Organista' }),
    m('Fadrigon', 'Maria Katrina', 'soprano-2', { notes: 'Kalihim ng Mang-aawit (Panguluhan)' }),
    m('Gulleban', 'Glycel', 'soprano-2'),
    m('Honrada', 'Zeinob', 'soprano-2'),
    m('Jubilo', 'Louraine', 'soprano-2', { inactive: true }),
    m('Lagang', 'Princess Nicole', 'soprano-2'),
    m('Lucas', 'Noriza', 'soprano-2'),
    m('Manga', 'Ruzzel Joy', 'soprano-2', { inactive: true }),
    m('Mamitag', 'Tim Jierra', 'soprano-2', { inactive: true }),
    m('Maramba', 'Helen', 'soprano-2', { notes: 'SICK LEAVE: na-stroke po' }),
    m('Napile', 'Leyra Janine', 'soprano-2'),
    m('Noble', 'Angelica', 'soprano-2', { inactive: true }),
    m('Obrique', 'Helen', 'soprano-2'),
    m('Parangue', 'Erica Jane', 'soprano-2'),
    m('Pardeño', 'Jane', 'soprano-2'),
    m('Patagnan', 'Alexis', 'soprano-2'),
    m('Quijano', 'Marion', 'soprano-2', { notes: 'Organista (ATPA)' }),
    m('Ragasa', 'Nica Iana', 'soprano-2'),
    m('Rana', 'Queenie', 'soprano-2'),
    m('Reginio', 'Elizabeth', 'soprano-2'),
    m('Rodriguez', 'Merl Marianne', 'soprano-2'),
    m('Rosales', 'Dovie Lou', 'soprano-2'),
    m('Sabino', 'Jamaica', 'soprano-2'),
    m('Sales', 'Julienne', 'soprano-2'),
    m('Santuyo', 'Fritzie Lien', 'soprano-2'),
    m('Sayod', 'Mary Glen', 'soprano-2'),
    m('Vilando', 'Emerose', 'soprano-2'),
    m('Villaespin', 'Sylvia', 'soprano-2'),
    m('Wabingga', 'Meah', 'soprano-2'),

    // ── Alto ─────────────────────────────────────────────────────
    m('Corpuz', 'Christine', 'alto', { notes: 'Organista' }),
    m('Dakingking', 'Renelyn', 'alto'),
    m('Fruponga', 'Lizel', 'alto'),
    m('Gabunales', 'Joralyn', 'alto', { notes: 'OIC (Panguluhan)' }),
    m('Hidalgo', 'Filvy May', 'alto'),
    m('Oville', 'Lyneth', 'alto'),
    m('Pardeño', 'Marian', 'alto'),
    m('Rodriguez', 'Diane Grace', 'alto'),
    m('Sales', 'Julie Anne', 'alto', { notes: 'Pangulong Mang-aawit (Panguluhan)' }),
    m('Sulit', 'Nouella Mae', 'alto'),
    m('Truman', 'Jovah', 'alto'),

    // ── Tenor ────────────────────────────────────────────────────
    m('Alilano', 'Angelo', 'tenor'),
    m('Bello', 'Vynze', 'tenor'),
    m('Bermejo', 'Tyler', 'tenor'),
    m('Candolita', 'Kinejay', 'tenor'),
    m('Devero', 'Allan', 'tenor'),
    m('Dimpas', 'Justine', 'tenor'),
    m('Fadrigon', 'Aljon Carlo', 'tenor'),
    m('Jomillo', 'Reden', 'tenor'),
    m('Montilla', 'Jethro', 'tenor'),
    m('Sales', 'Eldie', 'tenor'),
    m('Santuyo', 'Howell', 'tenor'),

    // ── Bass ─────────────────────────────────────────────────────
    m('Aboc', 'Ronil', 'bass'),
    m('Asil', 'Jefferson', 'bass'),
    m('Copio', 'Prince Jacob', 'bass'),
    m('Dalendeg', 'Kim Charles', 'bass', { inactive: true }),
    m('De Guzman', 'Jeron', 'bass'),
    m('Dimpas', 'John Christian', 'bass'),
    m('Encierto', 'Nino Rafael', 'bass'),
    m('Fama', 'Joemar', 'bass'),
    m('Fortes', 'Kim', 'bass'),
    m('Garcia', 'Francis William', 'bass', { notes: 'Organista' }),
    m('Gariando', 'Cezar', 'bass'),
    m('Gulleban', 'Rodel Jr.', 'bass'),
    m('Jomillo', 'Marco', 'bass', { notes: 'OIC / PNK OIC (Panguluhan)' }),
    m('Lubiano', 'Reuben', 'bass'),
    m('Magbago', 'Abijohn', 'bass'),
    m('Manga', 'Rejiel', 'bass'),
    m('Naval', 'John Mark', 'bass'),
    m('Oville', 'Rolly Jr.', 'bass', { inactive: true }),
    m('Pailaga', 'Prince Gian', 'bass'),
    m('Redondo', 'Drix', 'bass'),
    m('Suyat', 'Leonardo IV', 'bass'),

    // ── Panguluhan only (no voice section listed in the PDF) ─────
    m('Walapo', '', 'alto', {
      notes: 'II Pangulong Mang-aawit (Panguluhan) — no voice section listed in PDF',
    }),
  ]
}

export function seedTrainees(): Trainee[] {
  let n = 0
  const t = (
    lastName: string,
    firstName: string,
    gender: 'male' | 'female',
    opts: { notes?: string } = {},
  ): Trainee => {
    n += 1
    return {
      id: `t-${String(n).padStart(3, '0')}`,
      firstName,
      lastName,
      gender,
      voicePosition: gender === 'female' ? 'soprano-2' : 'tenor',
      status: 'active',
      dateAdded: DATE_ADDED,
      notes: opts.notes,
    }
  }

  return [
    // Nagsasanay sa pagiging mang-aawit (Babae)
    t('Nalam', 'Keisha', 'female'),
    t('Serilla', 'Rica Joy', 'female'),
    t('', 'Fraleigh', 'female', { notes: 'No surname listed in PDF' }),
    t('Valenzuela', 'Hanna', 'female'),
    t('Cabanigan', 'Jenelyn', 'female'),
    t('Lagang', 'Jhobelyn', 'female'),
    t('Abela', 'Rachelle', 'female', { notes: 'Balik-Tungkulin' }),

    // Nagsasanay sa pagiging mang-aawit (Lalaki)
    t('De Villa', 'Ejay', 'male'),
    t('Gabunales', 'AJ', 'male'),
    t('Navales', 'Isaias Jr.', 'male'),
  ]
}

export function seedSuguan(): Suguan[] {
  return []
}