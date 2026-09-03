export function formatMoney(cents) {
  const value = Math.abs(cents) / 100;
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function formatDateChip(dateStr) {
  const d = new Date(dateStr);
  return {
    day: d.getDate(),
    month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
  };
}

export function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
