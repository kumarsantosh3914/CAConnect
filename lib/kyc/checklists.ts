export const KYC_ENTITY_TYPES = [
  'individual', 'proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited', 'huf',
] as const

export type KycEntityType = (typeof KYC_ENTITY_TYPES)[number]
export type KycItem = { label: string; isRequired: boolean }

const person: KycItem[] = [
  { label: 'PAN card', isRequired: true },
  { label: 'Aadhaar card', isRequired: true },
  { label: 'Address proof', isRequired: true },
  { label: 'Passport-size photo', isRequired: true },
]

export const KYC_CHECKLISTS: Record<KycEntityType, KycItem[]> = {
  individual: person,
  proprietorship: [...person, { label: 'Business registration / Udyam certificate', isRequired: true }, { label: 'GST certificate (if registered)', isRequired: false }],
  partnership: [{ label: 'Firm PAN card', isRequired: true }, { label: 'Partnership deed', isRequired: true }, { label: 'Registered address proof', isRequired: true }, { label: 'KYC documents for all partners', isRequired: true }],
  llp: [{ label: 'Certificate of Incorporation', isRequired: true }, { label: 'LLP agreement', isRequired: true }, { label: 'LLP PAN card', isRequired: true }, { label: 'Registered address proof', isRequired: true }, { label: 'KYC documents for all designated partners', isRequired: true }],
  private_limited: [{ label: 'Certificate of Incorporation', isRequired: true }, { label: 'MOA and AOA', isRequired: true }, { label: 'Company PAN card', isRequired: true }, { label: 'Board resolution', isRequired: true }, { label: 'Registered address proof', isRequired: true }, { label: 'KYC documents for all directors', isRequired: true }],
  public_limited: [{ label: 'Certificate of Incorporation', isRequired: true }, { label: 'MOA and AOA', isRequired: true }, { label: 'Company PAN card', isRequired: true }, { label: 'Board resolution', isRequired: true }, { label: 'Registered address proof', isRequired: true }, { label: 'KYC documents for all directors', isRequired: true }],
  huf: [{ label: 'HUF PAN card', isRequired: true }, { label: 'Karta PAN and Aadhaar', isRequired: true }, { label: 'HUF address proof', isRequired: true }, { label: 'HUF declaration / deed', isRequired: true }],
}

export const KYC_ENTITY_LABELS: Record<KycEntityType, string> = {
  individual: 'Individual', proprietorship: 'Proprietorship', partnership: 'Partnership', llp: 'LLP',
  private_limited: 'Private Limited', public_limited: 'Public Limited', huf: 'HUF',
}
