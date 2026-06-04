export const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v) || 0);

export const formatDate = (
  d: Date | string | number | null | undefined,
  timezone: string = 'UTC',
  locale: string = 'en-US',
): string => {
  if (!d) return '-';
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: timezone }).format(dateObj);
};

export const formatDateTime = (
  d: Date | string | number | null | undefined,
  timezone: string = 'UTC',
  locale: string = 'en-US',
): string => {
  if (!d) return '-';
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone }).format(dateObj);
};

export const formatNumber = (n: number) => String(n);
export const formatPercent = (n: number) => `${n}%`;
export const formatPercentage = (n: number) => `${n}%`;
export const getCurrencySymbol = () => '$';
export const formatCompactCurrency = (v: number) => `$${v}`;

export const useFormatters = (config: { currency?: string; locale?: string; timezone?: string } = {}) => {
  const currency = config.currency || 'USD';
  const locale = config.locale || 'en-US';
  const timezone = config.timezone || 'UTC';
  return {
    formatCurrency: (v: number) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(v) || 0),
    formatDate: (d: Date | string | number | null | undefined) => formatDate(d, timezone, locale),
    formatDateTime: (d: Date | string | number | null | undefined) => formatDateTime(d, timezone, locale),
    formatRelativeTime: (d: Date | string | number | null | undefined) => (d ? String(d) : '-'),
    formatNumber: (n: number) => String(n),
    formatPercent: (n: number) => `${n}%`,
    formatPercentage: (n: number) => `${n}%`,
    getCurrencySymbol: () => '$',
    formatCompactCurrency: (v: number) => `$${v}`,
    currency,
    locale,
    timezone,
  };
};
