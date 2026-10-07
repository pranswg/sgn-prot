import type { SuguanDocFormat } from './suguan'

export interface OrganistaSuguanService {
  id: string
  heading: string
  organist: string
  reserve: string
}

export interface OrganistaSuguanRecord {
  id: string
  churchName: string
  pagsasanayDate: string
  services: OrganistaSuguanService[]
  docFormat: SuguanDocFormat
  pangulongMangaawitName: string
  destinadoName: string
  createdAt: string
  updatedAt: string
}
