export const formatCurrency = (v: number) => `$${v}`;
export const formatDate = (d: string) => d;
export const formatNumber = (n: number) => String(n);
export const formatPercent = (n: number) => `${n}%`;
export const useFormatters = () => ({
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
});
