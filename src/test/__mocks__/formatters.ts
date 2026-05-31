export const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v) || 0);
export const formatDate = (d: string) => d;
export const formatNumber = (n: number) => String(n);
export const formatPercent = (n: number) => `${n}%`;
export const useFormatters = () => ({
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
});
