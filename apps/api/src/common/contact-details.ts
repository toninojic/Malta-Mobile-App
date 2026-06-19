export const CONTACT_DETAILS_BLOCKED_MESSAGE =
  'Contact details are not allowed in offers. Contact unlock is available after token payment.';

export function containsContactDetails(value: string) {
  const text = value.toLowerCase();
  const emailPattern = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
  const urlPattern =
    /\b(?:https?:\/\/|www\.|wa\.me\/|t\.me\/|(?:instagram|facebook|linkedin|telegram|whatsapp|viber)\.com\/)[^\s]+/i;
  const contactPhrasePattern =
    /\b(?:call|text|sms|whatsapp|viber|email|e-mail|dm|direct message|contact|reach)\s+(?:me|my|us)\b/i;
  const socialHandlePattern = /\b(?:instagram|facebook|telegram|whatsapp|viber|linkedin)\s*[:@]\s*[a-z0-9_.-]{3,}/i;

  return (
    emailPattern.test(text) ||
    urlPattern.test(text) ||
    contactPhrasePattern.test(text) ||
    socialHandlePattern.test(text) ||
    containsPhoneLikeNumber(text)
  );
}

function containsPhoneLikeNumber(value: string) {
  const phoneCandidatePattern = /(?:^|[^\w])(?:\+?\d[\d\s().-]{6,}\d)(?=$|[^\w])/g;
  const dateLikePattern =
    /^\s*(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\s*$/;
  let match: RegExpExecArray | null;

  while ((match = phoneCandidatePattern.exec(value))) {
    const candidate = match[0].trim();
    const digitCount = candidate.replace(/\D/g, '').length;

    if (digitCount >= 8 && digitCount <= 15 && !dateLikePattern.test(candidate)) {
      return true;
    }
  }

  return false;
}
