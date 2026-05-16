import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crmService } from './crmService';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const flush = () => vi.runAllTimersAsync();

describe('crmService', () => {
  describe('Given getLeads is called', () => {
    it('When the call resolves / Then returns a non-empty array', async () => {
      const promise = crmService.getLeads();
      await flush();
      const leads = await promise;
      expect(Array.isArray(leads)).toBe(true);
      expect(leads.length).toBeGreaterThan(0);
    });

    it('When the call resolves / Then each lead has id, company_name, and contact_name', async () => {
      const promise = crmService.getLeads();
      await flush();
      const leads = await promise;
      leads.forEach(lead => {
        expect(lead.id).toBeTruthy();
        expect(lead.company_name).toBeTruthy();
        expect(lead.contact_name).toBeTruthy();
      });
    });

    it('When the call resolves / Then each lead has a status field', async () => {
      const promise = crmService.getLeads();
      await flush();
      const leads = await promise;
      leads.forEach(lead => expect(lead.status).toBeDefined());
    });
  });

  describe('Given getLeadById is called', () => {
    it('When called with the known id "l1" / Then returns the matching lead', async () => {
      const lead = await crmService.getLeadById('l1');
      expect(lead).toBeDefined();
      expect(lead?.id).toBe('l1');
    });

    it('When called with an unknown id / Then returns undefined', async () => {
      const lead = await crmService.getLeadById('does-not-exist');
      expect(lead).toBeUndefined();
    });
  });

  describe('Given createLead is called', () => {
    it('When valid lead data is provided / Then returns a lead with a generated id', async () => {
      const created = await crmService.createLead({
        company_name: 'Acme Corp',
        contact_name: 'Jane Smith',
        contact_email: 'jane@acme.com',
        phone: '+1-555-0100',
        source: 'Website',
        status: 'Open',
        custom_fields: {},
        activities: [],
        notes: [],
      });
      expect(created.id).toBeTruthy();
      expect(created.company_name).toBe('Acme Corp');
    });

    it('When a lead is created / Then it has a created_at timestamp', async () => {
      const created = await crmService.createLead({
        company_name: 'Beta Ltd',
        contact_name: 'Bob Lee',
        contact_email: 'bob@beta.com',
        phone: '',
        source: 'Referral',
        status: 'Open',
        custom_fields: {},
        activities: [],
        notes: [],
      });
      expect(created.created_at).toBeTruthy();
    });

    it('When a lead is created / Then it has an owner assigned', async () => {
      const created = await crmService.createLead({
        company_name: 'Gamma Inc',
        contact_name: 'Carol White',
        contact_email: 'carol@gamma.com',
        phone: '',
        source: 'Cold Call',
        status: 'Open',
        custom_fields: {},
        activities: [],
        notes: [],
      });
      expect(created.owner).toBeDefined();
    });
  });

  describe('Given updateLead is called', () => {
    it('When a partial update is applied to lead "l1" / Then returns the updated lead with the same id', async () => {
      const promise = crmService.updateLead('l1', { company_name: 'TechFlow Renamed' });
      await flush();
      const result = await promise;
      expect(result.id).toBe('l1');
    });
  });

  describe('Given getDeals is called', () => {
    it('When the call resolves / Then returns a non-empty array', async () => {
      const promise = crmService.getDeals();
      await flush();
      const deals = await promise;
      expect(Array.isArray(deals)).toBe(true);
      expect(deals.length).toBeGreaterThan(0);
    });
  });

  describe('Given getDealById is called', () => {
    it('When called with an unknown id / Then returns undefined', async () => {
      const deal = await crmService.getDealById('nonexistent');
      expect(deal).toBeUndefined();
    });
  });

  describe('Given updateDealStage is called', () => {
    it('When stage and reason are provided / Then resolves without error', async () => {
      await expect(crmService.updateDealStage('d1', 'Won', 'Customer signed contract')).resolves.toBeUndefined();
    });

    it('When no reason is provided / Then resolves without error', async () => {
      await expect(crmService.updateDealStage('d1', 'Qualification')).resolves.toBeUndefined();
    });
  });

  describe('Given getDealsByLeadId is called', () => {
    it('When called with a lead id / Then returns an array (possibly empty)', async () => {
      const promise = crmService.getDealsByLeadId('l1');
      await flush();
      const deals = await promise;
      expect(Array.isArray(deals)).toBe(true);
    });
  });

  describe('Given getTasks is called', () => {
    it('When the call resolves / Then returns an array', async () => {
      const promise = crmService.getTasks();
      await flush();
      const tasks = await promise;
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('Given getTaskById is called', () => {
    it('When called with an unknown id / Then returns undefined', async () => {
      const task = await crmService.getTaskById('nonexistent');
      expect(task).toBeUndefined();
    });
  });

  describe('Given getTasksByLeadId is called', () => {
    it('When called with a lead id / Then returns an array', async () => {
      const promise = crmService.getTasksByLeadId('l1');
      await flush();
      const tasks = await promise;
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('Given updateTask is called', () => {
    it('When called with task id "t1" and a title update / Then returns a task with id "t1"', async () => {
      const promise = crmService.updateTask('t1', { title: 'Follow up call' } as any);
      await flush();
      const result = await promise;
      expect(result.id).toBe('t1');
    });
  });

  describe('Given getSettings is called', () => {
    it('When the call resolves / Then settings contain deal_stages array', async () => {
      const promise = crmService.getSettings();
      await flush();
      const settings = await promise;
      expect(Array.isArray(settings.deal_stages)).toBe(true);
      expect(settings.deal_stages.length).toBeGreaterThan(0);
    });

    it('When the call resolves / Then settings contain lead_custom_fields', async () => {
      const promise = crmService.getSettings();
      await flush();
      const settings = await promise;
      expect(settings.lead_custom_fields).toBeDefined();
    });

    it('When the call resolves / Then settings contain lead_sources', async () => {
      const promise = crmService.getSettings();
      await flush();
      const settings = await promise;
      expect(settings.lead_sources).toBeDefined();
    });
  });

  describe('Given updateSettings is called', () => {
    it('When new settings are passed / Then returns the same settings object', async () => {
      const newSettings = {
        deal_stages: [],
        default_owner_id: 'u2',
        lead_sources: ['LinkedIn'],
        lead_custom_fields: [],
        deal_custom_fields: [],
        lead_scoring: [],
      };
      const promise = crmService.updateSettings(newSettings);
      await flush();
      const result = await promise;
      expect(result).toEqual(newSettings);
    });
  });

  describe('Given updateNote is called', () => {
    it('When called with lead id, note id and new content / Then resolves without error', async () => {
      const promise = crmService.updateNote('l1', 'n1', 'Updated note text');
      await flush();
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('Given deleteNote is called', () => {
    it('When called with lead id and note id / Then resolves without error', async () => {
      const promise = crmService.deleteNote('l1', 'n1');
      await flush();
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('Given getUsers is called', () => {
    it('When the call resolves / Then returns a non-empty array of users', async () => {
      const users = await crmService.getUsers();
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
    });

    it('When the call resolves / Then each user has id and full_name', async () => {
      const users = await crmService.getUsers();
      users.forEach(u => {
        expect(u.id).toBeTruthy();
        expect(u.full_name).toBeTruthy();
      });
    });
  });

  describe('Given uploadDocument is called', () => {
    it('When a File is provided / Then returns an attachment with the correct name and type', async () => {
      const file = new File(['pdf content'], 'spec.pdf', { type: 'application/pdf' });
      const promise = crmService.uploadDocument('entity-abc', file);
      await flush();
      const attachment = await promise;
      expect(attachment.name).toBe('spec.pdf');
      expect(attachment.type).toBe('application/pdf');
    });

    it('When a File is uploaded / Then the returned attachment has a generated id and a url', async () => {
      const file = new File(['img'], 'photo.png', { type: 'image/png' });
      const promise = crmService.uploadDocument('entity-xyz', file);
      await flush();
      const attachment = await promise;
      expect(attachment.id).toBeTruthy();
      expect(attachment.url).toBe('#');
    });
  });

  describe('Given deleteDocument is called', () => {
    it('When called with entity id and document id / Then resolves without error', async () => {
      const promise = crmService.deleteDocument('entity-1', 'doc-42');
      await flush();
      await expect(promise).resolves.toBeUndefined();
    });
  });
});
