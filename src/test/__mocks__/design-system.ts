import React from 'react';

export const Button = (props: any) => props;
export const Input = (props: any) => props;
export const Select = (props: any) => props;
export const Modal = (props: any) => props;
export const Card = (props: any) => props;
export const Badge = (props: any) => props;
export const Spinner = (props: any) => props;
export const Tooltip = (props: any) => props;
export const QuotaBar = ({ children }: any) => React.createElement('div', { 'data-testid': 'quota-bar' }, children);
export const QuotaGate = ({ children }: any) => React.createElement('div', { 'data-testid': 'quota-gate' }, children);
export const SandboxBanner = () => React.createElement('div', { 'data-testid': 'sandbox-banner' });
export const UpgradePrompt = () => React.createElement('div', { 'data-testid': 'upgrade-prompt' });

const inert = (children: any) =>
  React.createElement('div', { className: 'pointer-events-none select-none opacity-60', 'aria-disabled': true, tabIndex: -1 }, children);

export const FeatureRoute = ({ state, children, hiddenFallback = null, lockedFallback, disabledFallback }: any) => {
  if (state === 'hidden') return React.createElement(React.Fragment, null, hiddenFallback);
  if (state === 'locked') return React.createElement(React.Fragment, null, lockedFallback != null ? lockedFallback : children);
  if (state === 'disabled') return disabledFallback !== undefined ? React.createElement(React.Fragment, null, disabledFallback) : inert(children);
  if (state === 'read_only') return inert(children);
  return React.createElement(React.Fragment, null, children);
};

export const FeatureGate = ({ state, children, fallback = null, onUpgradeClick, lockedLabel = 'Upgrade to unlock' }: any) => {
  if (state === 'hidden') return React.createElement(React.Fragment, null, fallback);
  if (state === 'enabled') return React.createElement(React.Fragment, null, children);
  if (state === 'read_only' || state === 'disabled') return inert(children);
  return React.createElement('div', { className: 'relative' },
    React.createElement('div', { className: 'pointer-events-none select-none opacity-60' }, children),
    React.createElement('button', { type: 'button', onClick: onUpgradeClick, 'aria-label': lockedLabel }, lockedLabel));
};
