export type PhoneCountry = {
  code: string;
  name: string;
  dialCode: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'MT', name: 'Malta', dialCode: '+356' },
  { code: 'RS', name: 'Serbia', dialCode: '+381' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44' },
  { code: 'IT', name: 'Italy', dialCode: '+39' },
  { code: 'DE', name: 'Germany', dialCode: '+49' },
  { code: 'FR', name: 'France', dialCode: '+33' },
  { code: 'ES', name: 'Spain', dialCode: '+34' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31' },
  { code: 'IE', name: 'Ireland', dialCode: '+353' },
  { code: 'HR', name: 'Croatia', dialCode: '+385' },
  { code: 'SI', name: 'Slovenia', dialCode: '+386' },
  { code: 'AT', name: 'Austria', dialCode: '+43' },
  { code: 'CH', name: 'Switzerland', dialCode: '+41' },
  { code: 'PT', name: 'Portugal', dialCode: '+351' },
  { code: 'GR', name: 'Greece', dialCode: '+30' },
  { code: 'CY', name: 'Cyprus', dialCode: '+357' },
  { code: 'PL', name: 'Poland', dialCode: '+48' },
  { code: 'RO', name: 'Romania', dialCode: '+40' },
  { code: 'BG', name: 'Bulgaria', dialCode: '+359' },
  { code: 'HU', name: 'Hungary', dialCode: '+36' },
  { code: 'CZ', name: 'Czech Republic', dialCode: '+420' },
  { code: 'SK', name: 'Slovakia', dialCode: '+421' },
  { code: 'SE', name: 'Sweden', dialCode: '+46' },
  { code: 'NO', name: 'Norway', dialCode: '+47' },
  { code: 'DK', name: 'Denmark', dialCode: '+45' },
  { code: 'FI', name: 'Finland', dialCode: '+358' },
  { code: 'BE', name: 'Belgium', dialCode: '+32' },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0] as PhoneCountry;

export function splitPhoneNumber(value?: string | null) {
  const trimmed = value?.trim() ?? '';
  const digits = trimmed.replace(/\D/g, '');
  const normalized = trimmed.startsWith('+') ? `+${digits}` : digits ? `+${digits}` : '';
  const country =
    PHONE_COUNTRIES
      .slice()
      .sort((a, b) => b.dialCode.length - a.dialCode.length)
      .find((item) => normalized.startsWith(item.dialCode)) ?? DEFAULT_PHONE_COUNTRY;

  const localNumber = normalized.startsWith(country.dialCode)
    ? normalized.slice(country.dialCode.length)
    : digits;

  return { country, localNumber };
}

export function normalizePhoneInput(country: PhoneCountry, localNumber: string) {
  const digits = localNumber.replace(/\D/g, '').replace(/^0+/, '');
  return digits ? `${country.dialCode}${digits}` : '';
}
