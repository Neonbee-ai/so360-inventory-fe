// Stub for @so360/design-system — vi.mock() in each test overrides these
import React from 'react';
import { useNavigate } from 'react-router-dom';
export const Button = ({ children, onClick, type, disabled, variant, size, loading, ...rest }: any) =>
  React.createElement('button', { onClick, type, disabled, 'data-comb': 'button', 'data-variant': variant, 'data-size': size, 'data-loading': loading ? 'true' : undefined, ...rest }, children);
// ---- Form primitives: render native elements carrying label, testid, value/onChange ----
const FieldWrap = ({ id, label, hint, error, children }: any) =>
  label || hint || error
    ? React.createElement('div', null,
        label ? React.createElement('label', { htmlFor: id }, label) : null,
        children,
        hint ? React.createElement('p', null, hint) : null,
        error ? React.createElement('p', { role: 'alert' }, error) : null)
    : children;
export const TextField = ({ label, hint, error, required, name, id, size: _s, leadingIcon: _li, 'data-testid': testId, ...rest }: any) => {
  const fid = label ? `f-${name}` : id;
  return React.createElement(FieldWrap, { id: fid, label, hint, error },
    React.createElement('input', { ...rest, id: fid, name, required, 'data-testid': testId, 'aria-invalid': error ? true : rest['aria-invalid'] }));
};
export const Textarea = ({ label, hint, error, required, name, id, size: _s, 'data-testid': testId, ...rest }: any) => {
  const fid = label ? `f-${name}` : id;
  return React.createElement(FieldWrap, { id: fid, label, hint, error },
    React.createElement('textarea', { ...rest, id: fid, name, required, 'data-testid': testId, 'aria-invalid': error ? true : rest['aria-invalid'] }));
};
export const Select = ({ value, onChange, options = [], placeholder, label, hint: _h, error, size: _sz, required, name, className: _c, ...rest }: any) => {
  const el = React.createElement('select', { id: rest.id ?? (label ? `f-${name}` : undefined), name, required, disabled: rest.disabled, title: rest.title, multiple: rest.multiple, value: value ?? '', onChange: (e: any) => { onChange?.(e); rest.onValueChange?.(e.target.value); }, 'aria-label': rest['aria-label'] ?? (label ? undefined : placeholder), 'data-testid': rest['data-testid'] },
    placeholder ? React.createElement('option', { key: '__ph', value: '', disabled: true }, placeholder) : null,
    options.map((o: any) => React.createElement('option', { key: String(o.value), value: o.value, disabled: o.disabled }, o.label)));
  return label || error ? React.createElement('div', null, label ? React.createElement('label', { htmlFor: el?.props?.id ?? `f-${name}` }, label) : null, el, error ? React.createElement('p', { role: 'alert' }, error) : null) : el;
};
export const Modal = ({ open, onClose, title, description, footer, children, dismissible = true, 'data-testid': testId }: any) => {
  React.useEffect(() => {
    if (!open || !dismissible) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, dismissible, onClose]);
  return open
    ? React.createElement(React.Fragment, null,
      React.createElement('div', { 'data-testid': 'modal-overlay', className: 'fixed inset-0 bg-overlay/70', onClick: dismissible ? onClose : undefined }),
      React.createElement('div', { role: 'dialog', 'aria-modal': 'true', 'aria-label': typeof title === 'string' ? title : undefined, 'data-testid': testId, className: 'relative flex max-h-[90vh] flex-col' },
        React.createElement('h2', null, title),
        description ? React.createElement('div', null, description) : null,
        React.createElement('button', { type: 'button', 'aria-label': 'Close', disabled: !dismissible, onClick: dismissible ? onClose : undefined }, 'x'),
        React.createElement('div', null, children),
        footer ? React.createElement('div', null, footer) : null))
    : null;
};
export const Drawer = ({ isOpen, onClose, title, subtitle, footer, toolbar, children, name, 'data-testid': testId }: any) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);
  return isOpen
    ? React.createElement('aside', { role: 'dialog', 'aria-label': typeof title === 'string' ? title : undefined, 'data-testid': testId ?? (name ? `drawer-${name}` : undefined) },
        React.createElement('h2', null, title),
        subtitle ? React.createElement('p', null, subtitle) : null,
        React.createElement('button', { type: 'button', 'aria-label': 'Close', onClick: onClose }, 'x'),
        toolbar ?? null,
        React.createElement('div', null, children),
        footer ? React.createElement('div', null, footer) : null)
    : null;
};
export const ColorPicker = ({ value, onChange, name, 'aria-label': ariaLabel, 'data-testid': testId }: any) =>
  React.createElement('input', { type: 'color', name, value, 'aria-label': ariaLabel, 'data-testid': testId, onChange: (e: any) => onChange?.(e.target.value) });
export const Slider = ({ value, onChange, min = 0, max = 100, step = 1, name, 'aria-label': ariaLabel, 'data-testid': testId }: any) =>
  React.createElement('input', { type: 'range', name, min, max, step, value, 'aria-label': ariaLabel, 'data-testid': testId, onChange: (e: any) => onChange?.(Number(e.target.value)) });
export const PortalProvider = ({ children }: any) => React.createElement(React.Fragment, null, children);
export const usePortalContainer = () => (typeof document !== 'undefined' ? document.body : null);
export const Card = ({ title, actions, footer, children, 'data-testid': testId }: any) =>
    React.createElement('div', { 'data-testid': testId }, title ? React.createElement('h3', null, title) : null, actions, children, footer);
export const Badge = ({ children, onClick, tone, size, 'data-testid': testId }: any) =>
  React.createElement('span', { onClick, 'data-testid': testId, 'data-tone': tone, 'data-size': size }, children);
export const Pagination = ({ page, currentPage, pageSize, pageSizeOptions, onPageSizeChange, total, totalItems, totalPages, onPageChange }: any) => {
  const cur = Number(page ?? currentPage ?? 1);
  const pages = totalPages ?? 1;
  return React.createElement('nav', { 'data-testid': 'pagination', 'data-page': String(page ?? currentPage ?? ''), 'data-size': String(pageSize ?? ''), 'data-total': String(total ?? totalItems ?? '') },
    onPageChange ? React.createElement('button', { type: 'button', disabled: cur <= 1, onClick: () => onPageChange(cur - 1) }, 'Previous') : null,
    onPageChange ? React.createElement('span', null, `Page ${cur} of ${pages}`) : null,
    onPageChange ? React.createElement('button', { type: 'button', disabled: cur >= pages, onClick: () => onPageChange(cur + 1) }, 'Next') : null,
    onPageSizeChange && pageSizeOptions ? React.createElement('select', { 'aria-label': 'Rows per page', value: String(pageSize), onChange: (e: any) => onPageSizeChange(Number(e.target.value)) }, ...pageSizeOptions.map((o: number) => React.createElement('option', { key: o, value: String(o) }, String(o)))) : null);
};
export const CrossLinkChip = ({ label, id }: any) =>
  React.createElement('span', { 'data-testid': 'cross-link-chip' }, label ?? id ?? '');
export const RelatedRecordsPanel = () => null;

export const UserSelector = ({ value, onChange, multiSelect, placeholder }: any) =>
  React.createElement('button', {
    type: 'button',
    'data-testid': 'user-selector',
    'data-value': Array.isArray(value) ? value.join(',') : (value ?? ''),
    onClick: () => onChange(multiSelect ? ['user-1', 'user-2'] : 'user-1'),
  }, placeholder ?? 'User');



// ListFilters stub — quick fields inline, `Filters · N` button toggles a drawer with all fields, chips for applied values.
const lfActive = (v: any) => v != null && v !== '' && v !== false && !(Array.isArray(v) && v.length === 0) && !(typeof v === 'object' && !Array.isArray(v) && !Object.values(v).some((x) => x != null && x !== ''));
const lfControl = (f: any, values: any, onChange: (v: any) => void, setOne: (k: string, v: any) => void) => {
  const v = values[f.key];
  const name = `filter-${f.key}`;
  if (f.type === 'custom') return React.createElement('div', { key: f.key, 'data-testid': name }, f.render?.(v, (n: any) => setOne(f.key, n)));
  if (f.type === 'select')
    return React.createElement('select', { key: f.key, 'aria-label': f.label, 'data-testid': name, value: typeof v === 'string' ? v : '', onChange: (e: any) => setOne(f.key, e.target.value || null) },
      React.createElement('option', { value: '' }, f.label), (f.options ?? []).map((o: any) => React.createElement('option', { key: o.value, value: o.value, 'data-count': o.count }, o.label)));
  if (f.type === 'multiselect')
    return React.createElement('select', { key: f.key, multiple: true, 'aria-label': f.label, 'data-testid': name, value: Array.isArray(v) ? v : [], onChange: (e: any) => setOne(f.key, Array.from(e.target.selectedOptions).map((o: any) => o.value)) },
      (f.options ?? []).map((o: any) => React.createElement('option', { key: o.value, value: o.value, 'data-count': o.count }, o.label)));
  if (f.type === 'boolean')
    return React.createElement('input', { key: f.key, type: 'checkbox', 'aria-label': f.label, 'data-testid': name, checked: !!v, onChange: (e: any) => setOne(f.key, e.target.checked || null) });
  if (f.type === 'daterange')
    return React.createElement('span', { key: f.key }, ['start', 'end'].map((side) => React.createElement('input', { key: side, type: 'date', 'aria-label': `${f.label} ${side}`, 'data-testid': `${name}-${side}`, value: (v as any)?.[side] ?? '', onChange: (e: any) => setOne(f.key, { ...(v as any), [side]: e.target.value }) })));
  if (f.type === 'numberrange')
    return React.createElement('span', { key: f.key }, ['min', 'max'].map((side) => React.createElement('input', { key: side, type: 'number', 'aria-label': `${f.label} ${side}`, 'data-testid': `${name}-${side}`, value: (v as any)?.[side] ?? '', onChange: (e: any) => setOne(f.key, { ...(v as any), [side]: e.target.value === '' ? null : Number(e.target.value) }) })));
  return React.createElement('input', { key: f.key, type: f.type === 'date' ? 'date' : 'text', 'aria-label': f.label, 'data-testid': name, value: typeof v === 'string' ? v : '', onChange: (e: any) => setOne(f.key, e.target.value || null) });
};
export const ListFilters = ({ fields = [], values = {}, onChange, onClear }: any) => {
  const [open, setOpen] = React.useState(false);
  const setOne = (k: string, v: any) => onChange({ ...values, [k]: v });
  const quick = fields.filter((f: any) => f.quick).slice(0, 3);
  const activeFields = fields.filter((f: any) => lfActive(values[f.key]));
  const drawerCount = activeFields.filter((f: any) => !f.quick).length;
  return React.createElement(React.Fragment, null,
    quick.map((f: any) => lfControl(f, values, onChange, setOne)),
    React.createElement('button', { type: 'button', 'data-testid': 'filters-button', onClick: () => setOpen((o) => !o) }, drawerCount ? `Filters · ${drawerCount}` : 'Filters'),
    open ? React.createElement('div', { role: 'dialog', 'aria-label': 'Filters', 'data-testid': 'filters-drawer' },
      fields.filter((f: any) => !f.quick).map((f: any) => React.createElement('label', { key: f.key }, f.label, lfControl(f, values, onChange, setOne))),
      React.createElement('button', { type: 'button', onClick: onClear }, 'Clear'),
      React.createElement('button', { type: 'button', onClick: () => setOpen(false) }, 'Apply')) : null,
    activeFields.length ? React.createElement('div', { 'data-testid': 'filter-chips' },
      activeFields.map((f: any) => React.createElement('button', { key: f.key, type: 'button', 'aria-label': `Remove ${f.label} filter`, onClick: () => setOne(f.key, null) }, `${f.label}: ${f.formatValue ? f.formatValue(values[f.key]) : Array.isArray(values[f.key]) ? values[f.key].join(', ') : String(f.options?.find((o: any) => o.value === values[f.key])?.label ?? (typeof values[f.key] === 'object' ? '' : values[f.key]))}`)),
      React.createElement('button', { type: 'button', onClick: onClear }, 'Clear all')) : null);
};
export const SearchInput = ({ value, onChange, onSearch, onClear: _oc, debounceMs: _d, loading: _l, shortcutHint: _s, size: _sz, placeholder, 'data-testid': testId, ...rest }: any) =>
  React.createElement('input', { type: 'search', placeholder, 'aria-label': rest['aria-label'] ?? placeholder, 'data-testid': testId, value: value ?? '', onChange: (e: any) => { onChange?.(e.target.value); onSearch?.(e.target.value); } });

// Comb trail (mirrors DS PageTrail): scope root auto-prepended, `←` goes to the last trail item via scope.navigate.
const CombScopeCtx = React.createContext<{ root?: { label: string; to: string }; navigate?: (to: string) => void }>({});
export const CombScope = ({ root, navigate, children }: any) => React.createElement(CombScopeCtx.Provider, { value: { root, navigate } }, children);
export const Trail = ({ trail, onBack, backLabel }: any) => {
  const scope = React.useContext(CombScopeCtx);
  // Specs that mock react-router's useNavigate observe the scope navigate through it (the real app wires scope.navigate = useNavigate()).
  let routerNav: any; try { routerNav = useNavigate(); } catch { routerNav = undefined; }
  if (!trail && !onBack) return null;
  let items: any[] = trail ?? [];
  if (scope.root && !(items[0] && items[0].to === scope.root.to)) items = [{ label: scope.root.label, to: scope.root.to }, ...items];
  const last = items[items.length - 1];
  const go = (i: any) => (i.onClick ? i.onClick() : (scope.navigate ?? routerNav)?.(i.to));
  return React.createElement(React.Fragment, null,
    onBack ? React.createElement('button', { 'aria-label': backLabel ?? 'Back', onClick: onBack }) : last ? React.createElement('button', { 'aria-label': `Back to ${last.label}`, 'data-comb-id': 'back', onClick: () => go(last) }) : null,
    items.length ? React.createElement('nav', { 'data-comb-id': 'breadcrumb', 'aria-label': 'Breadcrumb' }, items.map((i: any) => React.createElement('a', { key: i.label, 'data-comb': 'navitem', 'data-comb-to': i.to, href: i.to, onClick: (e: any) => { e.preventDefault(); go(i); } }, i.label))) : null);
};
// Comb page templates — slots render in template order with data-slot markers so specs can assert layout contract.
const slot = (name: string, node: any) => (node ? React.createElement('div', { 'data-slot': name }, node) : null);
export const ListPageTemplate = (p: any) =>
  React.createElement('div', { 'data-template': 'list' },
    React.createElement('header', { 'data-slot': 'header' },
      React.createElement(Trail, p), React.createElement('h1', null, p.title), p.count != null ? React.createElement('span', { 'data-slot': 'count' }, p.count) : null,
      slot('primary', p.primaryAction), slot('secondary', p.headerSecondaryActions), slot('overflow', Array.isArray(p.overflowActions) ? p.overflowActions.map((a: any) => React.createElement('button', { key: a.label, onClick: a.onSelect }, a.label)) : p.overflowActions)),
    slot('kpis', p.kpis),
    React.createElement('div', { 'data-slot': 'toolbar' }, p.views ? React.createElement('div', { 'data-slot': 'views' }, p.views) : null, p.search, p.filterConfig ? React.createElement(ListFilters, p.filterConfig) : null, p.filters, p.toolbar, p.toolbarEnd),
    p.loading ? React.createElement('div', { 'data-slot': 'skeleton' }) : null,
    !p.loading && p.isEmpty ? React.createElement('div', { 'data-slot': 'empty' }, p.empty) : null,
    !p.loading && p.isFilteredEmpty ? React.createElement('div', { 'data-slot': 'filtered-empty' }, React.createElement('button', { onClick: p.onClearFilters }, 'Clear filters')) : null,
    !p.isEmpty ? p.children : null,
    slot('pagination', p.pagination));
export const DetailPageTemplate = (p: any) =>
  React.createElement('div', { 'data-template': 'detail' },
    React.createElement('header', { 'data-slot': 'header' },
      React.createElement(Trail, p),
      React.createElement('h1', null, p.title), slot('status', p.status), slot('meta', p.meta),
      slot('secondary', p.secondaryActions && React.createElement(React.Fragment, null, ...p.secondaryActions)),
      slot('primary', p.primaryAction),
      slot('overflow', p.overflowActions && p.overflowActions.map((a: any) =>
        React.createElement('button', { key: a.label, onClick: a.onSelect, disabled: a.disabled, 'data-danger': String(!!a.danger) }, a.label)))),
    p.tabs ? React.createElement('div', { 'data-slot': 'tabs', role: 'tablist' }, p.tabs.map((t: any) =>
      React.createElement('button', { key: t.id, role: 'tab', 'aria-selected': t.id === p.activeTab, onClick: () => p.onTabChange?.(t.id) }, t.label))) : null,
    p.loading ? React.createElement('div', { 'data-slot': 'skeleton' }) : null,
    React.createElement('main', { 'data-slot': 'main' }, p.children),
    slot('rail', p.sidePanel));
export const FormPageTemplate = (p: any) =>
  React.createElement('div', { 'data-template': 'form' },
    React.createElement('header', { 'data-slot': 'header' }, React.createElement(Trail, p), React.createElement('h1', null, p.title), p.description ? React.createElement('p', null, p.description) : null),
    (p.sections ?? []).map((sec: any) => React.createElement('section', { key: sec.id, 'data-slot': 'section' }, React.createElement('h2', null, sec.title), sec.content)),
    p.children,
    React.createElement('footer', { 'data-slot': 'footer' }, p.destructiveAction,
      p.onCancel ? React.createElement('button', { type: 'button', onClick: p.onCancel }, p.cancelLabel ?? 'Cancel') : null, p.secondaryAction, p.primaryAction));
export const EmptyState = ({ title, description, action }: any) =>
  React.createElement('div', { 'data-testid': 'empty-state' }, React.createElement('p', null, title), description ? React.createElement('p', null, description) : null,
    action ? (React.isValidElement(action) ? action : React.createElement('button', { type: 'button', 'data-testid': (action as any)['data-testid'] ?? 'empty-state-action', onClick: (action as any).onClick }, (action as any).label)) : null);
export const ConfirmDialog = ({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }: any) =>
  open ? React.createElement('div', { role: 'dialog' }, React.createElement('h2', null, title), React.createElement('p', null, message),
    React.createElement('button', { onClick: onCancel }, cancelLabel), React.createElement('button', { onClick: onConfirm }, confirmLabel)) : null;
export const Tabs = ({ items = [], value, onChange, end }: any) =>
  React.createElement('div', { role: 'tablist' },
    items.map((t: any) =>
      React.createElement('button', { key: t.id, role: 'tab', 'aria-selected': t.id === value, onClick: () => onChange?.(t.id) }, t.icon, t.label)),
    end ? React.createElement('div', { 'data-slot': 'tabs-end' }, end) : null);
export const Skeleton = () => React.createElement('div', { 'data-testid': 'skeleton' });
export const DashboardPageTemplate = (p: any) =>
  React.createElement('div', { 'data-template': 'dashboard' },
    React.createElement('header', { 'data-slot': 'header' },
      React.createElement(Trail, p), React.createElement('h1', null, p.title), p.description ? React.createElement('p', null, p.description) : null,
      slot('meta', p.meta), slot('secondary-actions', p.secondaryActions), slot('primary-action', p.primaryAction)),
    slot('filters', p.filters), slot('toolbar-end', p.toolbarEnd),
    slot('kpis', p.kpis), slot('primary', p.primary), slot('secondary', p.secondary), slot('bottom', p.bottom), p.children);
export const SettingsPageTemplate = (p: any) =>
  React.createElement('div', { 'data-template': 'settings' },
    React.createElement('header', { 'data-slot': 'header' }, React.createElement(Trail, p), React.createElement('h1', null, p.title),
      p.description ? React.createElement('p', null, p.description) : null, slot('primary-action', p.primaryAction)),
    React.createElement('nav', { 'data-slot': 'sections', role: 'tablist' }, (p.sections ?? []).map((s: any) =>
      React.createElement('button', { key: s.id, role: 'tab', 'aria-selected': s.id === p.activeSection, onClick: () => p.onSectionChange?.(s.id) }, s.label))),
    React.createElement('main', { 'data-slot': 'main' }, p.children));
export const SettingsCard = (p: any) =>
  React.createElement('section', null, p.title ? React.createElement('h2', null, p.title) : null, p.actions ? React.createElement('div', { 'data-slot': 'card-actions' }, p.actions) : null, p.children);
const slugifyId = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// Mirrors the real Menu: items render only while open; ids derive from `name`.
export const Menu = ({ trigger, items = [], name, 'data-testid': testId }: any) => {
    const [open, setOpen] = React.useState(false);
    const id = testId ?? (name ? name : 'menu');
    React.useEffect(() => {
        if (!open) return;
        const h = (e: any) => { if (!e.target?.closest?.('[role="menu"],[aria-haspopup="menu"]')) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);
    const trig = React.cloneElement(trigger, {
        onClick: (e: any) => { trigger.props?.onClick?.(e); setOpen((o: boolean) => !o); },
        'aria-haspopup': 'menu', 'aria-expanded': open,
    });
    return React.createElement(React.Fragment, null, trig, open ? React.createElement('div', { role: 'menu', 'data-testid': id },
        items.map((it: any, i: number) => React.createElement('button', {
            key: `${it.label}-${i}`, role: 'menuitem', 'data-testid': `${id}-${slugifyId(it.label)}`, 'aria-disabled': it.disabled ? 'true' : undefined,
            onClick: (e: any) => { e.stopPropagation(); if (it.disabled) return; it.onSelect(); setOpen(false); },
        }, it.label))) : null);
};
export const KpiCard = ({ label, value, hint, onClick, 'data-testid': testId }: any) =>
    React.createElement('div', { 'data-testid': testId, onClick }, React.createElement('span', null, label), React.createElement('span', null, value),
        hint != null && hint !== false ? React.createElement('span', { 'data-slot': 'kpi-hint' }, hint) : null);
export const KpiGrid = ({ children }: any) => React.createElement('div', null, children);
export const CountUp = ({ value }: any) => React.createElement(React.Fragment, null, String(value));
export const useCountUp = (target: number) => target;
export const StatusBadge = ({ status, 'data-testid': testId }: any) => React.createElement('span', { 'data-testid': testId }, status);
export const Alert = ({ title, children, variant, action, 'data-testid': testId }: any) =>
    React.createElement('div', { role: 'alert', 'data-variant': variant, 'data-testid': testId }, title ? React.createElement('p', null, title) : null, children,
        action ? React.createElement('button', { type: 'button', onClick: action.onClick }, action.label) : null);

export const SegmentedControl = ({ options = [], value, onChange, 'data-testid': testId, 'aria-label': ariaLabel }: any) =>
  React.createElement(
    'div',
    { role: 'radiogroup', 'aria-label': ariaLabel, 'data-testid': testId },
    options.map((o: any) =>
      React.createElement(
        'button',
        { key: o.value, type: 'button', role: 'radio', 'aria-checked': value === o.value, 'aria-pressed': value === o.value, disabled: o.disabled, onClick: () => onChange?.(o.value) },
        o.label,
      ),
    ),
  );

// Form primitive stubs — native elements carrying label, testid, value/onChange.
const fieldWrap = (name: any, label: any, error: any, el: any, id?: any) =>
  label || error ? React.createElement('div', null, label ? React.createElement('label', { htmlFor: el?.props?.id ?? `f-${name}` }, label) : null, el, error ? React.createElement('p', { role: 'alert' }, error) : null) : el;
const numberStub = (kind: string) => ({ label, hint: _h, error, size: _sz, name, value, onChange, currency: _cur, locale: _loc, fractionDigits: _fd, allowNegative: _an, defaultValue, ...rest }: any) =>
  fieldWrap(name, label, error, React.createElement('input', {
    id: rest.id ?? (label ? `f-${name}` : undefined), name, type: 'number', 'data-kind': kind,
    ...(value !== undefined ? { value: value ?? '' } : { defaultValue: defaultValue ?? '' }),
    onChange: (e: any) => onChange?.(e.target.value === '' ? null : Number(e.target.value)), ...rest }));
export const NumberInput = numberStub('number');
export const CurrencyInput = numberStub('currency');
export const DatePicker = ({ label, hint: _h, error, size: _sz, name, onChange, weekStartsOn: _w, isDateDisabled: _d, today: _t, trailing: _tr, ...rest }: any) =>
  fieldWrap(name, label, error, React.createElement('input', { id: rest.id ?? (label ? `f-${name}` : undefined), name, type: 'date', onChange: (e: any) => onChange?.(e.target.value), ...rest }));
export const DateInput = DatePicker;
export const TimePicker = ({ label, hint: _h, error, size: _sz, name, onChange, format: _f, step: _st, minTime: _mi, maxTime: _ma, ...rest }: any) =>
  fieldWrap(name, label, error, React.createElement('input', { id: rest.id ?? (label ? `f-${name}` : undefined), name, type: 'time', onChange: (e: any) => onChange?.(e.target.value), ...rest }));
export const Checkbox = ({ label, description: _d, indeterminate: _i, name, ...rest }: any) =>
  React.createElement('label', null, React.createElement('input', { type: 'checkbox', name, ...rest }), label);
export const Switch = ({ label, name, checked, onCheckedChange, disabled, 'data-testid': testId, ...rest }: any) =>
  React.createElement('button', { type: 'button', role: 'switch', name, 'aria-checked': !!checked, 'aria-label': label, disabled, 'data-testid': testId, onClick: () => onCheckedChange?.(!checked), ...rest });
export const RadioGroup = ({ name, label, options = [], value, onChange, disabled, 'data-testid': testId }: any) =>
  React.createElement('div', { role: 'radiogroup', 'aria-label': label, 'data-testid': testId ?? `radio-${name}` },
    options.map((o: any) => React.createElement('label', { key: o.value }, React.createElement('input', { type: 'radio', name, value: o.value, checked: value === o.value, disabled: disabled || o.disabled, 'data-testid': `radio-${name}-${o.value}`, onChange: () => onChange?.(o.value) }), o.label)));
export const IconButton = ({ label, icon, variant, size, tooltipSide: _t, hideTooltip: _h, selected, loading, ...rest }: any) =>
  React.createElement('button', { type: 'button', 'aria-label': label, title: label, 'data-comb': 'icon-button', 'data-variant': variant, 'data-size': size, 'data-selected': selected ? 'true' : undefined, 'data-loading': loading ? 'true' : undefined, ...rest }, icon);
export const ColumnsMenu = ({ label = 'Columns' }: any) => React.createElement('button', { type: 'button', 'aria-label': label }, label);
export const DataTable = ({ columns = [], rows = [], rowKey, loading, emptyState, onRowClick, rowActions, getRowProps, hiddenColumns, sortKey, sortDir, onSortChange, footer, selectedKeys, onSelectionChange, 'data-testid': testId }: any) => {
  const [open, setOpen] = React.useState<string | null>(null);
  if (loading) return React.createElement('div', { 'data-testid': 'datatable-loading' });
  if (rows.length === 0) return React.createElement('div', null, emptyState);
  const hid = new Set(hiddenColumns ?? []);
  const cols = columns.filter((c: any) => !hid.has(c.key));
  return React.createElement('table', { 'data-testid': testId },
    React.createElement('thead', null, React.createElement('tr', null,
      onSelectionChange ? React.createElement('th', { key: '__sel' }) : null,
      cols.map((c: any) => React.createElement('th', { key: c.key, 'aria-sort': sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined },
        c.sortable && onSortChange
          ? React.createElement('button', { type: 'button', 'data-testid': `${testId ?? 'datatable'}-sort-${c.key}`, onClick: () => onSortChange(c.key, sortKey === c.key && sortDir === 'asc' ? 'desc' : 'asc') }, c.header)
          : c.header)),
      rowActions ? React.createElement('th', { key: '__act' }) : null)),
    React.createElement('tbody', null, rows.map((r: any) => {
      const key = rowKey(r);
      const { className: _cn, ...rp } = getRowProps?.(r) ?? {};
      return React.createElement('tr', { key, ...rp, onClick: onRowClick ? () => onRowClick(r) : undefined },
        onSelectionChange ? React.createElement('td', { key: '__sel' }, React.createElement('input', { type: 'checkbox', 'aria-label': 'Select row', checked: !!selectedKeys?.has(key), onClick: (e: any) => e.stopPropagation(), onChange: () => { const n = new Set(selectedKeys ?? []); n.has(key) ? n.delete(key) : n.add(key); onSelectionChange(n); } })) : null,
        cols.map((c: any) => React.createElement('td', { key: c.key, 'data-align': c.align }, c.render ? c.render(r) : String(r[c.key] ?? ''))),
        rowActions ? React.createElement('td', { key: '__act', onClick: (e: any) => e.stopPropagation() },
          React.createElement('button', { type: 'button', 'aria-label': 'Row actions', 'data-testid': `${testId ?? 'datatable'}-actions-${key}`, onClick: () => setOpen(open === key ? null : key) }, 'Actions'),
          open === key ? React.createElement('div', { role: 'menu' }, rowActions(r).map((it: any, i: number) => React.createElement('button', { key: `${it.label}-${i}`, role: 'menuitem', disabled: it.disabled, onClick: () => { it.onSelect(); setOpen(null); } }, it.label))) : null) : null);
    })),
    footer ? React.createElement('tfoot', null, React.createElement('tr', null, React.createElement('td', { colSpan: cols.length + 2 }, footer))) : null);
};
export const DateTimePicker = ({ label, hint: _h, error, name, onChange, defaultTime: _dt, minDate: _mi, maxDate: _ma, format: _f, step: _st, today: _t, ...rest }: any) =>
  fieldWrap(name, label, error, React.createElement('input', { id: rest.id ?? (label ? `f-${name}` : undefined), name, type: 'datetime-local', onChange: (e: any) => onChange?.(e.target.value), ...rest }));

// ---- Comb layout primitives: passthrough wrappers carrying data-testid / className ----
const passthrough = (defaultTestId: string, tag = 'div') => ({ children, className, 'data-testid': testId, as, ...rest }: any) =>
  React.createElement(as || tag, { className, 'data-testid': testId ?? defaultTestId, ...(rest['aria-label'] ? { 'aria-label': rest['aria-label'] } : {}) }, children);
export const GridItem = passthrough('grid-item');
export const Grid: any = passthrough('grid');
Grid.Item = GridItem;
export const Stack = passthrough('stack');
export const Region = ({ title, description, actions, children, 'data-testid': testId }: any) =>
  React.createElement('section', { 'data-testid': testId ?? 'region' },
    title ? React.createElement('h2', null, title) : null,
    description ? React.createElement('p', null, description) : null,
    actions ?? null,
    children);
export const Split = ({ rail, children, 'data-testid': testId }: any) =>
  React.createElement('div', { 'data-testid': testId ?? 'split' },
    React.createElement('div', { 'data-testid': 'split-main' }, children),
    rail ? React.createElement('aside', { 'data-testid': 'split-rail' }, rail) : null);
export const FormField = ({ label, children }: any) =>
  React.createElement('div', null, label ? React.createElement('label', null, label) : null, children);
export const Progress = ({ value, max = 100, label, showValue, 'data-testid': testId }: any) =>
  React.createElement('div', { role: 'progressbar', 'aria-valuenow': value, 'aria-valuemax': max, 'data-testid': testId }, label ?? null, showValue ? String(value) : null);


// ---------------------------------------------------------------------------
// Inventory-specific + extra Comb stand-ins (appended by the Comb migration).
// Rule for adding more: grep for the export name first, append once, keep the
// native element + label/testid contract so specs query by role/label/testid.
// ---------------------------------------------------------------------------
const h = React.createElement;

export const Input = ({ 'data-testid': testId, ...rest }: any) => h('input', { 'data-testid': testId, ...rest });
export const Spinner = ({ 'aria-label': label = 'Loading', 'data-testid': testId }: any) => h('span', { role: 'status', 'aria-label': label, 'data-testid': testId });
export const Tooltip = ({ children }: any) => h(React.Fragment, null, children);
export const QuotaBar = ({ children }: any) => h('div', { 'data-testid': 'quota-bar' }, children);
export const QuotaGate = ({ children }: any) => h('div', { 'data-testid': 'quota-gate' }, children);
export const SandboxBanner = () => h('div', { 'data-testid': 'sandbox-banner' });
export const UpgradePrompt = () => h('div', { 'data-testid': 'upgrade-prompt' });
export const DeleteConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText }: any) =>
  isOpen ? h('div', { role: 'dialog', 'aria-label': title }, h('p', null, message),
    h('button', { type: 'button', onClick: onConfirm }, confirmText ?? 'Delete'),
    h('button', { type: 'button', onClick: onClose }, 'Cancel')) : null;

const inert = (children: any) =>
  h('div', { className: 'pointer-events-none select-none opacity-60', 'aria-disabled': true, tabIndex: -1 }, children);
export const FeatureRoute = ({ state, loading, children, hiddenFallback = null, lockedFallback, disabledFallback }: any) => {
  if (loading) return null;
  if (state === 'hidden') return h(React.Fragment, null, hiddenFallback);
  if (state === 'locked') return h(React.Fragment, null, lockedFallback != null ? lockedFallback : children);
  if (state === 'disabled') return disabledFallback !== undefined ? h(React.Fragment, null, disabledFallback) : inert(children);
  if (state === 'read_only') return inert(children);
  return h(React.Fragment, null, children);
};
export const FeatureGate = ({ state, loading, children, fallback = null, onUpgradeClick, lockedLabel = 'Upgrade to unlock' }: any) => {
  if (loading) return null;
  if (state === 'hidden') return h(React.Fragment, null, fallback);
  if (state === 'enabled') return h(React.Fragment, null, children);
  if (state === 'read_only' || state === 'disabled') return inert(children);
  return h('div', { className: 'relative' },
    h('div', { className: 'pointer-events-none select-none opacity-60' }, children),
    h('button', { type: 'button', onClick: onUpgradeClick, 'aria-label': lockedLabel }, lockedLabel));
};

const toastFn = (_message?: any, _opts?: any) => 'toast-id';
export const toast = { success: toastFn, error: toastFn, warning: toastFn, info: toastFn, promise: (p: any) => p, dismiss: (_id?: any) => {} };
export const useToast = () => toast;
export const getErrorMessage = (e: any, fallback?: string) => (typeof e?.message === 'string' && e.message) || fallback || 'error';
export const attachToastErrorHandler = () => 0;
export const toastBus = { subscribe: () => () => {}, show: (_t?: any) => {}, dismiss: (_id?: any) => {}, getToasts: () => [] };

export const DepartmentSelector = ({ value, onChange, placeholder = 'Select department', disabled }: any) =>
  h('select', { 'aria-label': placeholder, 'data-testid': 'department-selector', value: value || '', disabled, onChange: (e: any) => onChange?.(e.target.value || null) },
    h('option', { value: '' }, placeholder), h('option', { value: 'dept-1' }, 'Operations'));

/** useConfirm stand-in: resolves from window.confirm so specs drive it with vi.spyOn(window, 'confirm'). */
export const useConfirm = () =>
  [async (opts: { title?: string; message?: any }) => window.confirm(String(opts?.message ?? opts?.title ?? '')), null] as const;

// ---- layout / structure ----
export const PageContainer = ({ children, 'data-testid': testId }: any) => h('div', { 'data-testid': testId ?? 'page-container' }, children);
export const PageHeader = ({ title, description, primaryAction, secondaryActions, actions, status, meta, count, ...p }: any) =>
  h('header', { 'data-slot': 'header' }, h(Trail, p), h('h1', null, title), count != null ? h('span', null, count) : null, description ? h('p', null, description) : null,
    status ?? null, meta ?? null, actions ?? null, secondaryActions ?? null, primaryAction ?? null);
export const Cluster = passthrough('cluster');
export const Divider = ({ label }: any) => h('hr', { 'aria-label': typeof label === 'string' ? label : undefined });
export const Collapsible = ({ trigger, open, defaultOpen, onOpenChange, children }: any) => {
  const [o, setO] = React.useState(!!defaultOpen);
  const isOpen = open ?? o;
  return h('div', null, h('div', { onClick: () => { setO(!isOpen); onOpenChange?.(!isOpen); } }, trigger), isOpen ? h('div', null, children) : null);
};
export const Link = ({ href, to, children, onClick, ...rest }: any) => h('a', { href: href ?? to, onClick, ...rest }, children);

// ---- forms ----
export const FormSection = ({ title, description, actions, children, 'data-testid': testId }: any) =>
  h('fieldset', { 'data-testid': testId }, h('legend', null, title), description ? h('p', null, description) : null, actions ?? null, children);
export const FieldGrid = passthrough('field-grid');
export const FieldGridItem = passthrough('field-grid-item');
export const FormActions = ({ submitLabel = 'Save', onSubmit, submitting, submitDisabled, onCancel, cancelLabel = 'Cancel', children, form, 'data-testid': testId }: any) =>
  h('div', { 'data-slot': 'form-actions', 'data-testid': testId },
    children ?? null,
    onCancel ? h('button', { type: 'button', onClick: onCancel }, cancelLabel) : null,
    h('button', { type: form || !onSubmit ? 'submit' : 'button', form, disabled: submitting || submitDisabled, onClick: onSubmit }, submitLabel));
export const FileUpload = ({ label, name, accept, multiple, onChange, onReject, disabled, error, prompt, 'data-testid': testId, 'aria-label': ariaLabel }: any) =>
  fieldWrap(name, label, error, h(React.Fragment, null,
    prompt ? h('span', null, prompt) : null,
    h('input', { id: label ? `f-${name}` : undefined, type: 'file', name, accept, multiple, disabled, 'aria-label': ariaLabel, 'data-testid': testId,
      onChange: (e: any) => {
        const all = Array.from(e.target.files ?? []) as File[];
        const exts = (accept ?? '').split(',').map((r: string) => r.trim().toLowerCase()).filter((r: string) => r.startsWith('.'));
        const ok = exts.length ? all.filter(f => exts.some((x: string) => f.name.toLowerCase().endsWith(x))) : all;
        if (ok.length !== all.length) onReject?.(all.filter(f => !ok.includes(f)).map(file => ({ file, reason: 'type', message: `${file.name}: file type not allowed` })));
        if (ok.length) onChange?.(ok);
      } })));
export const Combobox = ({ label, name, options = [], value, onChange, placeholder, error, disabled, 'data-testid': testId, 'aria-label': ariaLabel }: any) =>
  fieldWrap(name, label, error, h('select', { id: label ? `f-${name}` : undefined, name, disabled, 'aria-label': ariaLabel ?? (label ? undefined : placeholder), 'data-testid': testId, value: value ?? '',
    onChange: (e: any) => onChange?.(e.target.value || null) }, h('option', { value: '' }, placeholder ?? ''), options.map((o: any) => h('option', { key: String(o.value), value: o.value, disabled: o.disabled }, o.label))));
export const Chip = ({ children, selected, onSelectedChange, onClick, onRemove, removeLabel = 'Remove', disabled, 'data-testid': testId }: any) =>
  h('span', { 'data-testid': testId },
    h('button', { type: 'button', disabled, 'aria-pressed': selected, onClick: (e: any) => { onClick?.(e); onSelectedChange?.(!selected); } }, children),
    onRemove ? h('button', { type: 'button', 'aria-label': removeLabel, onClick: onRemove }, 'x') : null);

// ---- feedback / display ----
export const Banner = ({ title, children, variant, action, dismissible, onDismiss, 'data-testid': testId }: any) =>
  h('div', { role: 'status', 'data-variant': variant, 'data-testid': testId }, title ? h('p', null, title) : null, children,
    action ? h('button', { type: 'button', onClick: action.onClick }, action.label) : null,
    dismissible ? h('button', { type: 'button', 'aria-label': 'Dismiss', onClick: onDismiss }, 'x') : null);
export const Stepper = ({ steps = [], current = 0, onStepClick, 'data-testid': testId }: any) =>
  h('ol', { 'data-testid': testId ?? 'stepper' }, steps.map((s: any, i: number) =>
    h('li', { key: s.label, 'aria-current': i === current ? 'step' : undefined, 'data-state': i < current ? 'done' : i === current ? 'current' : 'todo', onClick: onStepClick ? () => onStepClick(i) : undefined }, s.label)));
export const DescriptionList = ({ items = [], title, emptyValue = '-', 'data-testid': testId }: any) =>
  h('dl', { 'data-testid': testId }, title ? h('h3', null, title) : null, items.map((it: any, i: number) =>
    h(React.Fragment, { key: `${it.label}-${i}` }, h('dt', null, it.label), h('dd', null, it.value ?? emptyValue))));
export const ResultState = ({ status, title, description, primaryAction, secondaryAction, 'data-testid': testId }: any) =>
  h('div', { role: 'status', 'data-status': status, 'data-testid': testId }, h('h2', null, title), description ? h('p', null, description) : null, primaryAction ?? null, secondaryAction ?? null);
export const StatCard = ({ label, value, hint, 'data-testid': testId }: any) =>
  h('div', { 'data-testid': testId }, h('span', null, label), h('span', null, value), hint ? h('span', null, hint) : null);
export const SectionCard = Card;
export const ChoiceCardGrid = passthrough('choice-card-grid');
export const SelectableCard = ({ children, selected, onClick, onSelect, 'data-testid': testId }: any) =>
  h('button', { type: 'button', 'aria-pressed': !!selected, 'data-testid': testId, onClick: onClick ?? onSelect }, children);
