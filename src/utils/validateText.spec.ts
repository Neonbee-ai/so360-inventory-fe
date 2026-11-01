import { describe, it, expect } from 'vitest';
import { validateText } from './validateText';

describe('validateText', () => {
  describe('Given a required field', () => {
    it('When the value is whitespace / Then it reports required', () => {
      expect(validateText('Name', '   ')).toBe('Name is required.');
    });
    it('When the value is valid / Then no error', () => {
      expect(validateText('Name', ' Finance ')).toBeUndefined();
    });
    it('When the value is unicode / Then no error', () => {
      expect(validateText('Name', 'Café 東京 🚀')).toBeUndefined();
    });
  });
  describe('Given a max length', () => {
    it('When exceeded / Then it reports at most N characters', () => {
      expect(validateText('Name', 'a'.repeat(121))).toBe('Name must be at most 120 characters.');
    });
    it('When a custom max is passed / Then it is honoured', () => {
      expect(validateText('Name', 'abcdef', { max: 5 })).toBe('Name must be at most 5 characters.');
    });
  });
  describe('Given markup characters', () => {
    it('When value has angle brackets / Then it reports invalid', () => {
      expect(validateText('Name', '<script>alert(1)</script>')).toMatch(/^Name is invalid/);
    });
  });
  describe('Given an optional field', () => {
    it('When empty / Then no error', () => {
      expect(validateText('Description', '', { required: false })).toBeUndefined();
    });
  });
});
