export const MALTA_SERVICE_LOCATIONS = [
  "Sliema",
  "St Julian's",
  'Valletta',
  'Gzira',
  'Msida',
  'Birkirkara',
  'Mosta',
  'Naxxar',
  'Qormi',
  'Rabat',
  'Mellieha',
  'Bugibba',
  "St Paul's Bay",
  'Marsaskala',
  'Marsaxlokk',
  'Zabbar',
  'Fgura',
  'Paola',
  'Marsa',
  'Luqa',
  'Zejtun',
].map((label) => ({
  key: normalizeLocationKey(label),
  label,
}));

export function normalizeLocationKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function serviceLocationLabel(keyOrLabel: string) {
  const key = normalizeLocationKey(keyOrLabel);
  return MALTA_SERVICE_LOCATIONS.find((location) => location.key === key)?.label ?? keyOrLabel.trim();
}

export function isKnownServiceLocation(keyOrLabel: string) {
  const key = normalizeLocationKey(keyOrLabel);
  return MALTA_SERVICE_LOCATIONS.some((location) => location.key === key);
}
