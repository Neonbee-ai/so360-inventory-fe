import { describe, it, expect } from 'vitest';
import { formatAddress, projectsOfDeveloper, toDeveloperProfile } from './developerProfile';

describe('Given a partner address (RE plan G1)', () => {
  describe('When it is free text', () => {
    it('Then it is trimmed, and blank text is no address', () => {
      expect(formatAddress('  Downtown, Dubai ')).toBe('Downtown, Dubai');
      expect(formatAddress('   ')).toBeNull();
    });
  });

  describe('When it is a structured object', () => {
    it('Then the known parts are joined in order and blanks skipped', () => {
      expect(formatAddress({ line1: 'Tower 1', line2: ' ', city: 'Dubai', postal_code: '00000', country: 'AE', junk: 'x' }))
        .toBe('Tower 1, Dubai, 00000, AE');
      expect(formatAddress({ address_line1: 'A', street: 'B', address_line2: 'C', state: 'D', zip: 'E' })).toBe('A, B, C, D, E');
    });

    it('Then an object with no known parts is no address', () => {
      expect(formatAddress({ foo: 'bar' })).toBeNull();
    });
  });

  describe('When it is missing, an array or a number', () => {
    it('Then there is no address', () => {
      expect(formatAddress(null)).toBeNull();
      expect(formatAddress(['a'])).toBeNull();
      expect(formatAddress(5)).toBeNull();
    });
  });
});

describe('Given a Core partner row for a developer', () => {
  const row = {
    id: 'p1',
    name: ' Emaar ',
    business_name: 'Emaar Properties PJSC',
    email: 'info@emaar.ae',
    phone: '+971 4 000',
    billing_address: { line1: 'Emaar Sq', city: 'Dubai', country: 'AE' },
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    metadata: {
      website: 'https://emaar.com',
      description: 'Master developer',
      logo_url: 'https://cdn/logo.png',
      account_manager_name: 'Sara',
      notes: 'Key account',
    },
  };

  describe('When it is shaped with a primary contact', () => {
    it('Then every RFP §3 field is filled from the row, metadata and contact', () => {
      expect(toDeveloperProfile(row, { contact_name: 'Ali', contact_email: 'ali@x', contact_phone: '+1' })).toEqual({
        id: 'p1',
        name: 'Emaar',
        company: 'Emaar Properties PJSC',
        contact_name: 'Ali',
        email: 'info@emaar.ae',
        phone: '+971 4 000',
        website: 'https://emaar.com',
        address: 'Emaar Sq, Dubai, AE',
        country: 'AE',
        description: 'Master developer',
        logo_url: 'https://cdn/logo.png',
        account_manager: 'Sara',
        status: 'active',
        notes: 'Key account',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
      });
    });
  });

  describe('When the row carries the fields as columns', () => {
    it('Then the columns win over metadata', () => {
      const dev = toDeveloperProfile({
        ...row, website: 'https://col', logo_url: 'https://col/logo', status: 'prospect', notes: 'col note',
        description: 'col desc', country: 'SA', account_manager_name: 'Omar', address: 'Riyadh',
      });
      expect(dev).toMatchObject({
        website: 'https://col', logo_url: 'https://col/logo', status: 'prospect', notes: 'col note',
        description: 'col desc', country: 'SA', account_manager: 'Omar', address: 'Riyadh',
      });
    });
  });

  describe('When the row lacks email/phone and name', () => {
    it('Then contact email/phone and the business name are used', () => {
      const dev = toDeveloperProfile(
        { id: 7, business_name: 'Sobha LLC', is_active: false, metadata: { account_manager: 'Lee', contact_name: 'Meta C' } },
        { contact_email: 'c@x', contact_phone: '+2' },
      );
      expect(dev).toMatchObject({
        id: '7', name: 'Sobha LLC', email: 'c@x', phone: '+2', status: 'inactive', account_manager: 'Lee', contact_name: 'Meta C',
      });
    });

    it('Then a contact person column and display name are used', () => {
      expect(toDeveloperProfile({ id: 'x', display_name: 'Disp', contact_person: 'CP', company_name: 'Co' }))
        .toMatchObject({ name: 'Disp', contact_name: 'CP', company: 'Co', status: null });
      expect(toDeveloperProfile({ id: 'x' }, { name: 'Nm' })).toMatchObject({ contact_name: 'Nm' });
    });

    it('Then metadata company and address are used', () => {
      expect(toDeveloperProfile({ id: 'x', metadata: { company: 'MetaCo', address: 'Meta St', country: 'OM' } }))
        .toMatchObject({ company: 'MetaCo', address: 'Meta St', country: 'OM' });
    });
  });

  describe('When the row is empty or not an object', () => {
    it('Then a blank profile named Developer is returned', () => {
      for (const input of [null, undefined, 'x']) {
        const dev = toDeveloperProfile(input, 'not-an-object');
        expect(dev.id).toBe('');
        expect(dev.name).toBe('Developer');
        expect(Object.entries(dev).filter(([k]) => k !== 'id' && k !== 'name').every(([, v]) => v === null)).toBe(true);
      }
    });

    it('Then non-object metadata is ignored', () => {
      expect(toDeveloperProfile({ id: 'x', metadata: 'oops' }).website).toBeNull();
    });
  });
});

describe('Given categories and a developer partner id', () => {
  const cats = [
    { id: 'c1', name: 'Zeta Towers', parent_id: null, metadata: { developer_partner_id: 'p1' } },
    { id: 'c2', name: 'Alpha Heights', parent_id: null, metadata: { developer_partner_id: 'p1' } },
    { id: 'c3', name: 'Tower A', parent_id: 'c2', metadata: { developer_partner_id: 'p1' } },
    { id: 'c4', name: 'Other', parent_id: null, metadata: { developer_partner_id: 'p2' } },
    { id: 'c5', name: 'No meta', parent_id: null, metadata: null },
  ] as any[];

  describe('When projectsOfDeveloper is called', () => {
    it('Then only root projects of that developer are returned, by name', () => {
      expect(projectsOfDeveloper(cats, 'p1').map((p) => p.id)).toEqual(['c2', 'c1']);
    });

    it('Then no id or no categories yields none', () => {
      expect(projectsOfDeveloper(cats, null)).toEqual([]);
      expect(projectsOfDeveloper(cats, '')).toEqual([]);
      expect(projectsOfDeveloper(null as any, 'p1')).toEqual([]);
      expect(projectsOfDeveloper([null] as any, 'p1')).toEqual([]);
    });
  });
});
