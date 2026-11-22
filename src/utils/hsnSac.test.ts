import { describe, it, expect } from 'vitest';
import { isHsnSacMasterEnabled, effectiveHsnKind, hsnKindLabel, hsnValidationWarning, HSN_SAC_MASTER_FLAG } from './hsnSac';

describe('hsnSac utils', () => {
  it('Given the flag is on / Then the master is enabled and the flag key is asked', () => {
    const fn = (k: string) => k === HSN_SAC_MASTER_FLAG;
    expect(isHsnSacMasterEnabled({ isFeatureEnabled: fn })).toBe(true);
  });
  it('Given the flag is off, missing or throwing / Then it is disabled', () => {
    expect(isHsnSacMasterEnabled({ isFeatureEnabled: () => false })).toBe(false);
    expect(isHsnSacMasterEnabled({ isFeatureEnabled: () => 'yes' })).toBe(false);
    expect(isHsnSacMasterEnabled({})).toBe(false);
    expect(isHsnSacMasterEnabled(undefined)).toBe(false);
    expect(isHsnSacMasterEnabled({ isFeatureEnabled: () => { throw new Error('x'); } })).toBe(false);
  });
  it('Given an explicit kind / Then it wins over the item type', () => {
    expect(effectiveHsnKind('goods', 'service')).toBe('goods');
    expect(effectiveHsnKind('service', 'product')).toBe('service');
  });
  it('Given no kind / Then service types search SAC and others HSN', () => {
    expect(effectiveHsnKind('', 'service')).toBe('service');
    expect(effectiveHsnKind('', 'product')).toBe('goods');
    expect(effectiveHsnKind(null, undefined)).toBe('goods');
  });
  it('Given a kind / Then it has a label', () => {
    expect(hsnKindLabel('goods')).toBe('Goods (HSN)');
    expect(hsnKindLabel('service')).toBe('Service (SAC)');
    expect(hsnKindLabel(null)).toBe('');
  });
  it('Given a saved item / Then only a non-blank string warning is returned', () => {
    expect(hsnValidationWarning({ hsn_validation_warning: 'down' })).toBe('down');
    expect(hsnValidationWarning({ hsn_validation_warning: '  ' })).toBeNull();
    expect(hsnValidationWarning({})).toBeNull();
    expect(hsnValidationWarning(null)).toBeNull();
  });
});
