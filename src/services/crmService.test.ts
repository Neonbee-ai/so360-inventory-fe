import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crmService } from './crmService';

// Use fake timers to avoid real delays
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const runAllTimers = () => vi.runAllTimersAsync();

describe('Given crmService', () => {
  describe('Given getLeads', () => {
    it('When called / Then returns an array of leads', async () => {
      const promise = crmService.getLeads();
      await runAllTimers();
      const leads = await promise;
      expect(Array.isArray(leads)).toBe(true);
      expect(leads.length).toBeGreaterThan(0);
    });

    it('When called / Then leads have required fields', async () => {
      const promise = crmService.getLeads();
      await runAllTimers();
      const leads = await promise;
      const lead = leads[0];
      expect(lead.id).toBeTruthy();
      expect(lead.company_name).toBeTruthy();
      expect(lead.contact_name).toBeTruthy();
    });
  });

  describe('Given createLead', () => {
    it('When called with lead data / Then returns a lead with generated id', async () => {
      const newLead = await crmService.createLead({
        company_name: 'Test Corp',
        contact_name: 'John Doe',
        contact_email: 'john@test.com',
        phone: '',
        source: 'Website',
        status: 'Open',
        custom_fields: {},
        activities: [],
        notes: [],
      });
      expect(newLead.id).toBeTruthy();
      expect(newLead.company_name).toBe('Test Corp');
      expect(newLead.owner).toBeDefined();
      expect(newLead.created_at).toBeTruthy();
    });
  });

  describe('Given getLeadById', () => {
    it('When called with valid id / Then returns the lead', async () => {
      // MOCK_LEADS has id 'l1' hardcoded
      const lead = await crmService.getLeadById('l1');
      expect(lead).toBeDefined();
      expect(lead?.id).toBe('l1');
    });

    it('When called with unknown id / Then returns undefined', async () => {
      const lead = await crmService.getLeadById('nonexistent');
      expect(lead).toBeUndefined();
    });
  });

  describe('Given getDeals', () => {
    it('When called / Then returns an array of deals', async () => {
      const promise = crmService.getDeals();
      await runAllTimers();
      const deals = await promise;
      expect(Array.isArray(deals)).toBe(true);
      expect(deals.length).toBeGreaterThan(0);
    });
  });

  describe('Given getDealById', () => {
    it('When called with unknown id / Then returns undefined', async () => {
      const deal = await crmService.getDealById('nonexistent');
      expect(deal).toBeUndefined();
    });
  });

  describe('Given updateDealStage', () => {
    it('When called / Then resolves without error', async () => {
      await expect(crmService.updateDealStage('d1', 'Won', 'Customer signed')).resolves.toBeUndefined();
    });

    it('When called without reason / Then resolves without error', async () => {
      await expect(crmService.updateDealStage('d1', 'Qualification')).resolves.toBeUndefined();
    });
  });

  describe('Given getTasks', () => {
    it('When called / Then returns an array of tasks', async () => {
      const promise = crmService.getTasks();
      await runAllTimers();
      const tasks = await promise;
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('Given getTaskById', () => {
    it('When called with unknown id / Then returns undefined', async () => {
      const task = await crmService.getTaskById('nonexistent');
      expect(task).toBeUndefined();
    });
  });

  describe('Given getDealsByLeadId', () => {
    it('When called / Then returns filtered deals array', async () => {
      const promise = crmService.getDealsByLeadId('l1');
      await runAllTimers();
      const deals = await promise;
      expect(Array.isArray(deals)).toBe(true);
    });
  });

  describe('Given getTasksByLeadId', () => {
    it('When called / Then returns filtered tasks array', async () => {
      const promise = crmService.getTasksByLeadId('l1');
      await runAllTimers();
      const tasks = await promise;
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('Given getSettings', () => {
    it('When called / Then returns settings with deal_stages', async () => {
      const promise = crmService.getSettings();
      await runAllTimers();
      const settings = await promise;
      expect(settings.deal_stages).toBeDefined();
      expect(settings.deal_stages.length).toBeGreaterThan(0);
    });

    it('When called / Then returns settings with lead_custom_fields', async () => {
      const promise = crmService.getSettings();
      await runAllTimers();
      const settings = await promise;
      expect(settings.lead_custom_fields).toBeDefined();
    });
  });

  describe('Given updateSettings', () => {
    it('When called with settings / Then returns the same settings', async () => {
      const settings = {
        deal_stages: [],
        default_owner_id: 'u1',
        lead_sources: [],
        lead_custom_fields: [],
        deal_custom_fields: [],
        lead_scoring: [],
      };
      const promise = crmService.updateSettings(settings);
      await runAllTimers();
      const result = await promise;
      expect(result).toEqual(settings);
    });
  });

  describe('Given updateLead', () => {
    it('When called / Then returns updated lead', async () => {
      const promise = crmService.updateLead('l1', { company_name: 'Updated Corp' });
      await runAllTimers();
      const result = await promise;
      expect(result.id).toBe('l1');
    });
  });

  describe('Given updateTask', () => {
    it('When called / Then returns updated task', async () => {
      const promise = crmService.updateTask('t1', { title: 'Updated Task' } as any);
      await runAllTimers();
      const result = await promise;
      expect(result.id).toBe('t1');
    });
  });

  describe('Given updateNote', () => {
    it('When called / Then resolves without error', async () => {
      const promise = crmService.updateNote('l1', 'n1', 'Updated content');
      await runAllTimers();
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('Given deleteNote', () => {
    it('When called / Then resolves without error', async () => {
      const promise = crmService.deleteNote('l1', 'n1');
      await runAllTimers();
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('Given getUsers', () => {
    it('When called / Then returns array of users', async () => {
      const users = await crmService.getUsers();
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
      expect(users[0].id).toBeTruthy();
      expect(users[0].full_name).toBeTruthy();
    });
  });

  describe('Given uploadDocument', () => {
    it('When called with file / Then returns attachment with file properties', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const promise = crmService.uploadDocument('entity-1', file);
      await runAllTimers();
      const attachment = await promise;
      expect(attachment.name).toBe('test.pdf');
      expect(attachment.type).toBe('application/pdf');
      expect(attachment.id).toBeTruthy();
      expect(attachment.url).toBe('#');
    });
  });

  describe('Given deleteDocument', () => {
    it('When called / Then resolves without error', async () => {
      const promise = crmService.deleteDocument('entity-1', 'doc-1');
      await runAllTimers();
      await expect(promise).resolves.toBeUndefined();
    });
  });
});
