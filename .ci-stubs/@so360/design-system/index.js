const noop = () => {};
const Empty = () => null;
const PassThrough = ({ children }) => children;

export const Button = ({ children, ...p }) => children || null;
export const Card = ({ children }) => children || null;
export const Can = PassThrough;
export const DepartmentSelector = Empty;
export const DeleteConfirmDialog = Empty;
export const FilterBar = Empty;
export const Input = () => null;
export const LeaveCalendar = Empty;
export const Modal = PassThrough;
export const Pagination = Empty;
export const PeopleSelector = Empty;
export const QuotaBar = PassThrough;
export const QuotaGate = PassThrough;
export const ReviewForm = Empty;
export const SandboxBanner = Empty;
export const Select = ({ children }) => children || null;
export const SortableHeader = ({ children }) => children || null;
export const Table = ({ children }) => children || null;
export const UpgradePrompt = Empty;
export const UserSelector = Empty;
export const FeatureRoute = ({ children }) => children || null;
export const FeatureGate = ({ children }) => children || null;
export const eventBus = { publish: noop, subscribe: () => noop };
const toastFn = () => 'toast-id';
export const toast = {
  success: toastFn,
  error: toastFn,
  warning: toastFn,
  info: toastFn,
  promise: (p) => p,
  dismiss: noop,
};
export const useToast = () => toast;
export const getErrorMessage = (_e, fallback) => fallback ?? 'error';
export const attachToastErrorHandler = () => 0;
export const toastBus = {
  subscribe: () => () => {},
  show: noop,
  dismiss: noop,
  getToasts: () => [],
};
export default {};
