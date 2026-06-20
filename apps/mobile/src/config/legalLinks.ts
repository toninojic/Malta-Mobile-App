import * as WebBrowser from 'expo-web-browser';

export const legalLinks = {
  termsOfUse: 'https://maltaproapp.online/wp-content/uploads/2026/06/Terms-of-Use.pdf',
  privacyPolicy: 'https://maltaproapp.online/wp-content/uploads/2026/06/Privacy-Policy.pdf',
  accountDeletionPolicy: 'https://maltaproapp.online/wp-content/uploads/2026/06/Account-Deletion-Policy.pdf',
  communityGuidelines: 'https://maltaproapp.online/wp-content/uploads/2026/06/Community-Guidelines.pdf',
  contractorVerificationPolicy: 'https://maltaproapp.online/wp-content/uploads/2026/06/Contractor-Verification-Policy.pdf',
} as const;

export async function openLegalLink(url: string) {
  await WebBrowser.openBrowserAsync(url);
}
