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
