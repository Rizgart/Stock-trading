export const formatCurrency = (value: number, currency: string = 'SEK'): string =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(value);

export const formatPct = (value: number): string => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
