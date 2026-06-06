function twoDigit(value: number) {
  return String(value).padStart(2, '0');
}

export function formatDate(value?: string | Date | null) {
  if (!value) {
    return 'N/A';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return `${twoDigit(date.getDate())}/${twoDigit(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatTime(value?: string | Date | null) {
  if (!value) {
    return 'N/A';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return `${twoDigit(date.getHours())}:${twoDigit(date.getMinutes())}`;
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return 'N/A';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return `${formatDate(date)} ${formatTime(date)}`;
}

export function formatChatTimestamp(value?: string | Date | null) {
  if (!value) {
    return 'N/A';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  return sameDay ? formatTime(date) : formatDateTime(date);
}

export function toDateInputValue(value?: string | Date | null) {
  const date = value ? (value instanceof Date ? value : new Date(value)) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return formatDate(date);
}

export function parseDateInput(value: string) {
  const [day, month, year] = value.split('/').map(Number);
  if (!day || !month || !year) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

export function toIsoDate(value: Date) {
  return value.toISOString();
}
