import React, { useState, useEffect } from 'react';
import { Alert, Button, Checkbox, Modal, Select, TextField, FieldGrid } from '@so360/design-system';
import { crmService } from '../../services/crmService';
import { CustomFieldDefinition } from '../../types/crm';

interface CreateLeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    existingLeads: string[]; // List of company names to detect duplicates
}

const LEAD_SOURCES = ['Website', 'Referral', 'Cold Call', 'LinkedIn'].map((v) => ({ value: v, label: v }));

export const CreateLeadModal = ({ isOpen, onClose, onSuccess, existingLeads }: CreateLeadModalProps) => {
    const [formData, setFormData] = useState({
        company_name: '',
        contact_name: '',
        contact_email: '',
        phone: '',
        source: 'Website',
        status: 'Open' as any,
        custom_fields: {} as Record<string, any>
    });

    const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const settings = await crmService.getSettings();
                setCustomFieldDefs(settings.lead_custom_fields);
            } catch (error) {
                console.error('Failed to fetch lead custom fields', error);
            }
        };
        if (isOpen) {
            fetchSettings();
        }
    }, [isOpen]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isDuplicate = existingLeads.some(
        name => name.toLowerCase() === formData.company_name.toLowerCase() && formData.company_name.length > 0
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            await crmService.createLead({
                ...formData,
                activities: [],
                notes: []
            });
            onSuccess();
            onClose();
        } catch (err) {
            setError('Failed to create lead. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const setCustom = (id: string, value: any) =>
        setFormData({ ...formData, custom_fields: { ...formData.custom_fields, [id]: value } });

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Create New Lead"
            dismissible={!isSubmitting}
            footer={
                <>
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" form="create-lead-form" loading={isSubmitting} disabled={isSubmitting}>
                        {isSubmitting ? 'Creating...' : 'Create Lead'}
                    </Button>
                </>
            }
        >
            <form id="create-lead-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && <Alert variant="error">{error}</Alert>}

                {isDuplicate && (
                    <Alert variant="warning">
                        Potential duplicate detected. A lead with this company name already exists.
                    </Alert>
                )}

                <TextField
                    name="company_name"
                    label="Company Name"
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="e.g. Acme Corp"
                />

                <FieldGrid>
                    <TextField
                        name="contact_name"
                        label="Contact Name"
                        required
                        value={formData.contact_name}
                        onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    />
                    <TextField
                        name="contact_email"
                        label="Contact Email"
                        type="email"
                        required
                        value={formData.contact_email}
                        onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    />
                </FieldGrid>

                <TextField
                    name="phone"
                    label="Phone (Optional)"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />

                <Select
                    name="source"
                    label="Lead Source"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    options={LEAD_SOURCES}
                />

                {customFieldDefs.length > 0 && (
                    <section className="flex flex-col gap-4 border-t border-line pt-4">
                        <h3 className="text-xs font-semibold text-fg-subtle">Additional Details</h3>
                        <FieldGrid>
                            {customFieldDefs.map((field) =>
                                field.type === 'boolean' ? (
                                    <Checkbox
                                        key={field.id}
                                        name={`custom_${field.id}`}
                                        label={field.label}
                                        checked={formData.custom_fields[field.id] || false}
                                        onChange={(e) => setCustom(field.id, e.target.checked)}
                                    />
                                ) : (
                                    <TextField
                                        key={field.id}
                                        name={`custom_${field.id}`}
                                        label={field.label}
                                        required={field.required}
                                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                        value={formData.custom_fields[field.id] || ''}
                                        onChange={(e) => setCustom(field.id, e.target.value)}
                                    />
                                ),
                            )}
                        </FieldGrid>
                    </section>
                )}
            </form>
        </Modal>
    );
};
