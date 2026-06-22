const EUROPEAN_DIAL_CODES = [
  '+356',
  '+381',
  '+44',
  '+39',
  '+49',
  '+33',
  '+34',
  '+31',
  '+353',
  '+385',
  '+386',
  '+43',
  '+41',
  '+351',
  '+30',
  '+357',
  '+48',
  '+40',
  '+359',
  '+36',
  '+420',
  '+421',
  '+46',
  '+47',
  '+45',
  '+358',
  '+32',
].sort((a, b) => b.length - a.length);

export function normalizePhoneNumber(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return undefined;
  }

  if (trimmed.startsWith('+')) {
    return `+${digits}`;
  }

  const compact = `+${digits}`;
  if (EUROPEAN_DIAL_CODES.some((dialCode) => compact.startsWith(dialCode))) {
    return compact;
  }

  return `+356${digits.replace(/^0+/, '')}`;
}
