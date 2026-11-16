import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import React from 'react';

// The component talks to the module service; mock the module so no request is made.
vi.mock('../../../services/productTypeService', () => ({
    productTypeService: {
        getAttributeGroups: vi.fn(),
        createAttributeGroup: vi.fn(),
        updateAttributeGroup: vi.fn(),
        deleteAttributeGroup: vi.fn(),
        updateAttribute: vi.fn(),
    },
}));

import AttributeGroupsPanel from './AttributeGroupsPanel';
import { productTypeService } from '../../../services/productTypeService';

const svc = productTypeService as unknown as {
    getAttributeGroups: ReturnType<typeof vi.fn>;
    createAttributeGroup: ReturnType<typeof vi.fn>;
    updateAttributeGroup: ReturnType<typeof vi.fn>;
    deleteAttributeGroup: ReturnType<typeof vi.fn>;
    updateAttribute: ReturnType<typeof vi.fn>;
};

const TYPE = 'pt-furniture';

const makeGroup = (overrides: Record<string, any> = {}) => ({
    id: 'g-dimensions',
    product_type_id: TYPE,
    group_key: 'dimensions',
    label: 'Dimensions',
    sort_order: 0,
    placements: { pdp_specs: true, card: false },
    ...overrides,
});

const makeAttribute = (overrides: Record<string, any> = {}) => ({
    id: 'a-length',
    product_type_id: TYPE,
    field_name: 'length',
    label: 'Length',
    field_type: 'number',
    is_required: false,
    sort_order: 0,
    group_id: null,
    ...overrides,
});

const renderPanel = (props: Record<string, any> = {}) =>
    render(
        <AttributeGroupsPanel
            productTypeId={TYPE}
            attributes={[]}
            canManage
            onChanged={vi.fn()}
            {...props}
        />,
    );

beforeEach(() => {
    vi.clearAllMocks();
    svc.getAttributeGroups.mockResolvedValue([]);
    svc.createAttributeGroup.mockResolvedValue({});
    svc.updateAttributeGroup.mockResolvedValue({});
    svc.deleteAttributeGroup.mockResolvedValue({});
    svc.updateAttribute.mockResolvedValue({});
});

// ── Empty state ──────────────────────────────────────────────────────────────

describe('Given a product type with no attribute groups', () => {
    it('When the panel loads / Then it explains what a group is and offers to create the first one', async () => {
        renderPanel();

        await waitFor(() => expect(screen.getByText('No attribute groups yet')).toBeInTheDocument());
        expect(screen.getByText('Create the first group')).toBeInTheDocument();
    });

    it('When "Create the first group" is clicked / Then the create form opens', async () => {
        renderPanel();
        await waitFor(() => expect(screen.getByText('Create the first group')).toBeInTheDocument());

        fireEvent.click(screen.getByText('Create the first group'));

        expect(screen.getByLabelText('Group name')).toBeInTheDocument();
        expect(screen.getByLabelText('Order')).toBeInTheDocument();
    });

    it('When there are no groups and no attributes / Then it asks for attributes first', async () => {
        renderPanel();
        await waitFor(() => expect(screen.getByText('No attribute groups yet')).toBeInTheDocument());
        expect(screen.getByText('Add an attribute above, then assign it to a group here.')).toBeInTheDocument();
    });
});

// ── Placement toggles ────────────────────────────────────────────────────────

describe('Given a group placed on the product specs but not the card', () => {
    beforeEach(() => {
        svc.getAttributeGroups.mockResolvedValue([makeGroup()]);
    });

    it('When the group renders / Then the two surface switches reflect its placements', async () => {
        renderPanel();

        await waitFor(() => expect(screen.getByLabelText('Show in product specs')).toBeInTheDocument());
        expect(screen.getByLabelText('Show in product specs')).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByLabelText('Show on product card')).toHaveAttribute('aria-checked', 'false');
    });

    it('When the card switch is turned on / Then only that surface is sent, and the switch flips at once', async () => {
        renderPanel();
        await waitFor(() => expect(screen.getByLabelText('Show on product card')).toBeInTheDocument());

        fireEvent.click(screen.getByLabelText('Show on product card'));

        expect(svc.updateAttributeGroup).toHaveBeenCalledWith(TYPE, 'g-dimensions', {
            placements: { card: true },
        });
        await waitFor(() =>
            expect(screen.getByLabelText('Show on product card')).toHaveAttribute('aria-checked', 'true'),
        );
    });

    it('When a surface the editor has no label for is stored / Then it is shown as its own switch and is not dropped', async () => {
        svc.getAttributeGroups.mockResolvedValue([
            makeGroup({ placements: { pdp_specs: true, quick_view: true } }),
        ]);
        renderPanel();

        await waitFor(() => expect(screen.getByLabelText('Quick view')).toBeInTheDocument());
        expect(screen.getByLabelText('Quick view')).toHaveAttribute('aria-checked', 'true');

        fireEvent.click(screen.getByLabelText('Quick view'));

        expect(svc.updateAttributeGroup).toHaveBeenCalledWith(TYPE, 'g-dimensions', {
            placements: { quick_view: false },
        });
    });
});

// ── Create + inline validation ───────────────────────────────────────────────

describe('Given the create-group form', () => {
    it('When it is submitted empty / Then the name error is inline and nothing is sent', async () => {
        renderPanel();
        fireEvent.click(screen.getByText('New group'));

        fireEvent.click(screen.getByText('Create group'));

        expect(screen.getByText('A group needs a name')).toBeInTheDocument();
        expect(svc.createAttributeGroup).not.toHaveBeenCalled();
    });

    it('When the name duplicates an existing group / Then it is rejected inline, case-insensitively', async () => {
        svc.getAttributeGroups.mockResolvedValue([makeGroup()]);
        renderPanel();
        await waitFor(() => expect(screen.getByText('Dimensions')).toBeInTheDocument());

        fireEvent.click(screen.getByText('New group'));
        fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'dimensions' } });
        fireEvent.click(screen.getByText('Create group'));

        expect(screen.getByText('A group with this name already exists')).toBeInTheDocument();
        expect(svc.createAttributeGroup).not.toHaveBeenCalled();
    });

    it('When the order is negative / Then the order error is inline and nothing is sent', async () => {
        renderPanel();
        fireEvent.click(screen.getByText('New group'));
        fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Care' } });
        fireEvent.change(screen.getByLabelText('Order'), { target: { value: '-1' } });

        fireEvent.click(screen.getByText('Create group'));

        expect(screen.getByText('Order must be a whole number from 0 to 999')).toBeInTheDocument();
        expect(svc.createAttributeGroup).not.toHaveBeenCalled();
    });

    it('When a valid group is created / Then the label, order and placements are sent', async () => {
        renderPanel();
        fireEvent.click(screen.getByText('New group'));
        fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Material & Finish' } });
        fireEvent.change(screen.getByLabelText('Order'), { target: { value: '2' } });
        fireEvent.click(screen.getByLabelText('Show on product card'));

        fireEvent.click(screen.getByText('Create group'));

        await waitFor(() => expect(svc.createAttributeGroup).toHaveBeenCalled());
        expect(svc.createAttributeGroup).toHaveBeenCalledWith(
            TYPE,
            expect.objectContaining({
                label: 'Material & Finish',
                sort_order: 2,
                placements: { card: true, pdp_specs: true },
            }),
        );
    });
});

// ── Edit / reorder / delete groups ───────────────────────────────────────────

describe('Given an existing group', () => {
    it('When it is edited / Then the new label is saved against the same group', async () => {
        svc.getAttributeGroups.mockResolvedValue([makeGroup()]);
        renderPanel();
        await waitFor(() => expect(screen.getByText('Dimensions')).toBeInTheDocument());

        fireEvent.click(screen.getByLabelText('Edit Dimensions'));
        fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Measurements' } });
        fireEvent.click(screen.getByText('Save group'));

        await waitFor(() => expect(svc.updateAttributeGroup).toHaveBeenCalled());
        expect(svc.updateAttributeGroup).toHaveBeenCalledWith(
            TYPE,
            'g-dimensions',
            expect.objectContaining({ label: 'Measurements' }),
        );
    });

    it('When "Move up" is used on the second group / Then both groups are renumbered in the new order', async () => {
        svc.getAttributeGroups.mockResolvedValue([
            makeGroup({ id: 'g-material', group_key: 'material', label: 'Material', sort_order: 0 }),
            makeGroup({ id: 'g-dimensions', group_key: 'dimensions', label: 'Dimensions', sort_order: 1 }),
        ]);
        renderPanel();
        await waitFor(() => expect(screen.getByLabelText('Move Dimensions up')).toBeInTheDocument());

        fireEvent.click(screen.getByLabelText('Move Dimensions up'));

        await waitFor(() => expect(svc.updateAttributeGroup).toHaveBeenCalledTimes(2));
        expect(svc.updateAttributeGroup).toHaveBeenCalledWith(TYPE, 'g-dimensions', { sort_order: 0 });
        expect(svc.updateAttributeGroup).toHaveBeenCalledWith(TYPE, 'g-material', { sort_order: 1 });
    });

    it('When it is deleted / Then the confirmation explains the attributes survive and the delete is sent', async () => {
        svc.getAttributeGroups.mockResolvedValue([makeGroup()]);
        renderPanel();
        await waitFor(() => expect(screen.getByText('Dimensions')).toBeInTheDocument());

        fireEvent.click(screen.getByLabelText('Delete Dimensions'));

        expect(screen.getByText('Delete attribute group?')).toBeInTheDocument();
        expect(screen.getByText(/become ungrouped/)).toBeInTheDocument();

        fireEvent.click(screen.getByText('Delete group'));

        await waitFor(() => expect(svc.deleteAttributeGroup).toHaveBeenCalledWith(TYPE, 'g-dimensions'));
    });
});

// ── Assigning and ordering attributes ────────────────────────────────────────

describe('Given ungrouped attributes', () => {
    it('When one is assigned to a group / Then the group id and the appended order are sent', async () => {
        svc.getAttributeGroups.mockResolvedValue([makeGroup()]);
        renderPanel({ attributes: [makeAttribute()] });
        await waitFor(() => expect(screen.getByLabelText('Group for Length')).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText('Group for Length'), {
            target: { value: 'g-dimensions' },
        });

        await waitFor(() => expect(svc.updateAttribute).toHaveBeenCalled());
        expect(svc.updateAttribute).toHaveBeenCalledWith(TYPE, 'a-length', {
            group_id: 'g-dimensions',
            sort_order: 0,
        });
    });

    it('When an attribute is unassigned / Then null is sent so the server stores no group', async () => {
        svc.getAttributeGroups.mockResolvedValue([makeGroup()]);
        renderPanel({ attributes: [makeAttribute({ group_id: 'g-dimensions' })] });
        await waitFor(() => expect(screen.getByLabelText('Group for Length')).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText('Group for Length'), { target: { value: '' } });

        await waitFor(() => expect(svc.updateAttribute).toHaveBeenCalled());
        expect(svc.updateAttribute).toHaveBeenCalledWith(TYPE, 'a-length', {
            group_id: null,
            sort_order: 0,
        });
    });
});

describe('Given two attributes in the same group', () => {
    it('When the second is moved up / Then only that group is renumbered', async () => {
        svc.getAttributeGroups.mockResolvedValue([makeGroup()]);
        renderPanel({
            attributes: [
                makeAttribute({ id: 'a-length', field_name: 'length', label: 'Length', sort_order: 0, group_id: 'g-dimensions' }),
                makeAttribute({ id: 'a-width', field_name: 'width', label: 'Width', sort_order: 1, group_id: 'g-dimensions' }),
            ],
        });
        await waitFor(() => expect(screen.getByLabelText('Move Width up')).toBeInTheDocument());

        fireEvent.click(screen.getByLabelText('Move Width up'));

        await waitFor(() => expect(svc.updateAttribute).toHaveBeenCalledTimes(2));
        expect(svc.updateAttribute).toHaveBeenCalledWith(TYPE, 'a-width', { sort_order: 0 });
        expect(svc.updateAttribute).toHaveBeenCalledWith(TYPE, 'a-length', { sort_order: 1 });
    });
});

// ── Read-only system templates ───────────────────────────────────────────────

describe('Given the read-only system template', () => {
    it('When rendered without manage rights / Then create is unavailable and the switches are disabled', async () => {
        svc.getAttributeGroups.mockResolvedValue([makeGroup()]);
        renderPanel({ canManage: false, attributes: [makeAttribute()] });

        // 'Dimensions' is legitimately painted twice once an attribute is on the
        // page: the group heading, and the option in that attribute's group
        // select. Scope to the group row so the query stays unambiguous.
        await waitFor(() =>
            expect(
                within(screen.getByTestId('attribute-group-dimensions')).getByText('Dimensions'),
            ).toBeInTheDocument(),
        );

        expect(screen.queryByText('New group')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Show on product card')).toBeDisabled();
        expect(screen.getByLabelText('Group for Length')).toBeDisabled();
        expect(screen.getByText(/read-only/)).toBeInTheDocument();
    });

    it('When there are no groups / Then the empty state offers no create action', async () => {
        renderPanel({ canManage: false });

        await waitFor(() => expect(screen.getByText('No attribute groups yet')).toBeInTheDocument());
        expect(screen.queryByText('Create the first group')).not.toBeInTheDocument();
    });
});

// ── Failure feedback ─────────────────────────────────────────────────────────

describe('Given the API rejects a group write', () => {
    it('When a group cannot be created / Then the reason is shown inline', async () => {
        svc.createAttributeGroup.mockRejectedValue(new Error('A group with this name already exists'));
        renderPanel();
        fireEvent.click(screen.getByText('New group'));
        fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Care' } });

        fireEvent.click(screen.getByText('Create group'));

        await waitFor(() =>
            expect(screen.getByText('A group with this name already exists')).toBeInTheDocument(),
        );
    });
});
