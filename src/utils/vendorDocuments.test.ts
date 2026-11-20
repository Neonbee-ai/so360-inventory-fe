import { describe, it, expect } from 'vitest';
import {
    activityLabel, changedFieldsText, documentTypeLabel, emptyDocumentForm, expiryBadge,
    toDocumentMeta, validateDocumentForm, verificationBadge,
} from './vendorDocuments';

/** BDD: vendor document + activity helpers (Pulse 3fc12200, 652f492e). */

const file = (name = 'a.pdf', size = 10) => {
    const f = new File(['x'], name);
    Object.defineProperty(f, 'size', { value: size });
    return f;
};

describe('documentTypeLabel', () => {
    it('Given a known type / Then its label', () => expect(documentTypeLabel('pan_card')).toBe('PAN card'));
    it('Given an unknown type / Then the raw value', () => expect(documentTypeLabel('passport')).toBe('passport'));
    it('Given nothing / Then "Document"', () => expect(documentTypeLabel(undefined)).toBe('Document'));
});

describe('expiryBadge', () => {
    it.each([
        ['expired', 3, 'danger', 'Expired'],
        ['expiring_soon', 0, 'warning', 'Expires today'],
        ['expiring_soon', 1, 'warning', 'Expires in 1 day'],
        ['expiring_soon', 12, 'warning', 'Expires in 12 days'],
        ['valid', 90, 'success', 'Valid'],
        ['no_expiry', null, 'neutral', 'No expiry'],
        [undefined, null, 'neutral', 'No expiry'],
    ])('Given %s (%s days) / Then %s "%s"', (state, days, tone, label) => {
        expect(expiryBadge(state as any, days as any)).toEqual({ tone, label });
    });
});

describe('verificationBadge', () => {
    it('Given verified / Then success', () => expect(verificationBadge('verified').tone).toBe('success'));
    it('Given rejected / Then danger', () => expect(verificationBadge('rejected').label).toBe('Rejected'));
    it('Given pending or unknown / Then warning', () => expect(verificationBadge(undefined).label).toBe('Pending review'));
});

describe('validateDocumentForm', () => {
    it('Given an empty form / Then type and file are required', () => {
        expect(validateDocumentForm(emptyDocumentForm())).toEqual({
            document_type: 'Choose the document type.',
            file: 'Choose a file to upload.',
        });
    });
    it('Given a file over 5 MB / Then a size error', () => {
        expect(validateDocumentForm({ ...emptyDocumentForm(), document_type: 'other', file: file('a.pdf', 6 * 1024 * 1024) }).file).toMatch(/5 MB/);
    });
    it('Given a disallowed extension / Then a type error', () => {
        expect(validateDocumentForm({ ...emptyDocumentForm(), document_type: 'other', file: file('a.docx') }).file).toMatch(/PDF, PNG or JPG/);
    });
    it('Given expiry before issue / Then an expiry error', () => {
        expect(validateDocumentForm({ ...emptyDocumentForm(), document_type: 'other', file: file('a.JPG'), issue_date: '2026-05-02', expiry_date: '2026-05-01' }))
            .toEqual({ expiry_date: 'Expiry date cannot be before the issue date.' });
    });
    it('Given a valid form / Then no errors', () => {
        expect(validateDocumentForm({ ...emptyDocumentForm(), document_type: 'other', file: file('a.jpeg'), issue_date: '2026-05-01', expiry_date: '2026-05-01' })).toEqual({});
    });
});

describe('toDocumentMeta', () => {
    it('Given blanks / Then they are omitted and text trimmed', () => {
        expect(toDocumentMeta({ ...emptyDocumentForm(), document_type: 'pan_card', document_number: ' ABCDE1234F ', notes: '  ' })).toEqual({
            document_type: 'pan_card', document_number: 'ABCDE1234F', issue_date: undefined, expiry_date: undefined, notes: undefined,
        });
    });
});

describe('activityLabel', () => {
    it('Given a known action / Then a plain label', () => expect(activityLabel('bank_set_primary')).toBe('Primary bank account changed'));
    it('Given an unknown action with a description / Then the description', () => expect(activityLabel('x', 'Something')).toBe('Something'));
    it('Given an unknown action only / Then the action', () => expect(activityLabel('x')).toBe('x'));
    it('Given nothing / Then "Activity"', () => expect(activityLabel('')).toBe('Activity'));
});

describe('changedFieldsText', () => {
    it('Given no fields / Then empty', () => expect(changedFieldsText(undefined)).toBe(''));
    it('Given profile fields / Then the prefix is dropped and words spaced', () => {
        expect(changedFieldsText(['name', 'vendor_profile.credit_days'])).toBe('name, credit days');
    });
    it('Given more than four / Then "+N more"', () => {
        expect(changedFieldsText(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('a, b, c, d +2 more');
    });
});
