import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActivity, useShellBridge } from '@so360/shell-context';
import {
    Alert, Button, EmptyState, FeatureGate, IconButton, SettingsCard, SettingsPageTemplate, Skeleton, StatusBadge, TextField, useConfirm, Grid,
} from '@so360/design-system';
import { Plus, Trash2, ChevronRight, Sliders } from 'lucide-react';
import { ProductType, ProductTypeAttribute } from '../../types/productTypes';
import { productTypeService } from '../../services/productTypeService';
import AttributeEditor from './components/AttributeEditor';

const ProductTypeSettingsPage = () => {
    const [confirm, confirmDialog] = useConfirm();
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const manageProductTypesState = (shell as any)?.getFeatureState ? (shell as any).getFeatureState('action:inventory:product_types:create') : 'enabled';
    const canManageProductTypes = (shell?.effectiveFlagsLoaded !== false) && manageProductTypesState === 'enabled';
    const [types, setTypes] = useState<ProductType[]>([]);
    const [selectedType, setSelectedType] = useState<ProductType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Create new type state
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCode, setNewCode] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Add attribute state
    const [showAddAttr, setShowAddAttr] = useState(false);

    useEffect(() => { loadTypes(); }, []);

    const loadTypes = async () => {
        try {
            setLoading(true);
            const data = await productTypeService.getAll();
            setTypes(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load product types');
        } finally {
            setLoading(false);
        }
    };

    const loadTypeDetail = async (id: string) => {
        try {
            const data = await productTypeService.getOne(id);
            setSelectedType(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load product type');
        }
    };

    const handleCreate = async () => {
        if (!newName.trim() || !newCode.trim()) return;
        setIsCreating(true);
        setError(null);
        try {
            await productTypeService.create({ name: newName.trim(), code: newCode.trim(), description: newDesc.trim() || undefined });
            recordActivity({ eventType: 'inventory.product_type.created', eventCategory: 'configuration', description: `Created product type "${newName.trim()}"`, resourceType: 'product_type' }).catch(() => {});
            setShowCreateForm(false);
            setNewName('');
            setNewCode('');
            setNewDesc('');
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await loadTypes();
        } catch (err: any) {
            setError(err.message || 'Failed to create product type');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!(await confirm({ title: 'Delete', message: 'Delete this product type?', intent: 'danger', confirmLabel: 'Delete' }))) return;
        setError(null);
        try {
            await productTypeService.delete(id);
            recordActivity({ eventType: 'inventory.product_type.deleted', eventCategory: 'configuration', description: 'Deleted a product type', resourceType: 'product_type', resourceId: id }).catch(() => {});
            if (selectedType?.id === id) setSelectedType(null);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await loadTypes();
        } catch (err: any) {
            setError(err.message || 'Failed to delete');
        }
    };

    const handleAddAttribute = async (data: any) => {
        if (!selectedType) return;
        setError(null);
        try {
            await productTypeService.addAttribute(selectedType.id, data);
            recordActivity({ eventType: 'inventory.product_type.attribute_added', eventCategory: 'configuration', description: `Added attribute to product type "${selectedType.name}"`, resourceType: 'product_type', resourceId: selectedType.id }).catch(() => {});
            setShowAddAttr(false);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await loadTypeDetail(selectedType.id);
        } catch (err: any) {
            setError(err.message || 'Failed to add attribute');
        }
    };

    const handleDeleteAttribute = async (attrId: string) => {
        if (!selectedType || !(await confirm({ title: 'Delete', message: 'Delete this attribute?', intent: 'danger', confirmLabel: 'Delete' }))) return;
        setError(null);
        try {
            await productTypeService.deleteAttribute(selectedType.id, attrId);
            recordActivity({ eventType: 'inventory.product_type.attribute_deleted', eventCategory: 'configuration', description: `Removed attribute from product type "${selectedType.name}"`, resourceType: 'product_type', resourceId: selectedType.id }).catch(() => {});
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await loadTypeDetail(selectedType.id);
        } catch (err: any) {
            setError(err.message || 'Failed to delete attribute');
        }
    };

    if (loading) return <div className="p-nb-6" aria-busy="true"><Skeleton variant="rect" /></div>;

    const canEditSelected = !!selectedType && !selectedType.is_system && canManageProductTypes;

    return (
        <SettingsPageTemplate
            title="Product Types"
            description="Manage product type templates and their attribute schemas"
            trail={[{ label: 'Settings', to: '/inventory/settings', onClick: () => navigate('/inventory/settings') }]}
        >
            {confirmDialog}
            {error && <Alert variant="error">{error}</Alert>}
            {success && <Alert variant="success">Saved successfully</Alert>}

            <Grid>
                {/* Left: Type list */}
                <Grid.Item span={4}>
                    <SettingsCard
                        title="Types"
                        actions={
                            <FeatureGate state={manageProductTypesState} loading={(shell?.effectiveFlagsLoaded === false)} onUpgradeClick={() => navigate('/org/billing')}>
                                <Button variant="secondary" size="sm" onClick={() => setShowCreateForm(true)}><Plus size={14} /> New</Button>
                            </FeatureGate>
                        }
                    >
                        <div className="flex flex-col gap-nb-2">
                            {showCreateForm && (
                                <div className="flex flex-col gap-nb-2 border-b border-line pb-nb-3">
                                    <TextField
                                        name="product-type-name"
                                        aria-label="Name"
                                        value={newName}
                                        onChange={e => { setNewName(e.target.value); setNewCode(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_')); }}
                                        placeholder="Name *"
                                        autoFocus
                                    />
                                    <TextField name="product-type-code" aria-label="Code" value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="Code *" />
                                    <TextField name="product-type-description" aria-label="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description" />
                                    <div className="flex justify-end gap-nb-2">
                                        <Button variant="secondary" size="sm" onClick={() => setShowCreateForm(false)}>Cancel</Button>
                                        <Button size="sm" onClick={handleCreate} disabled={isCreating || !newName.trim() || !newCode.trim()} loading={isCreating}>Create</Button>
                                    </div>
                                </div>
                            )}

                            {types.map(pt => (
                                <Button
                                    key={pt.id}
                                    variant={selectedType?.id === pt.id ? 'tonal' : 'ghost'}
                                    className="w-full justify-between"
                                    onClick={() => loadTypeDetail(pt.id)}
                                >
                                    <span className="flex flex-col items-start text-left">
                                        <span className="text-nb-body font-medium text-fg">{pt.name}</span>
                                        <span className="text-nb-caption text-fg-subtle">{pt.code}</span>
                                    </span>
                                    {pt.is_system && <StatusBadge status="System" />}
                                    <ChevronRight size={14} className="text-fg-subtle" />
                                </Button>
                            ))}
                        </div>
                    </SettingsCard>
                </Grid.Item>

                {/* Right: Type detail + attributes */}
                <Grid.Item span={8}>
                    {selectedType ? (
                        <SettingsCard
                            title={selectedType.name}
                            description={selectedType.description || selectedType.code}
                            actions={canEditSelected ? (
                                <IconButton label="Delete product type" icon={<Trash2 size={18} />} variant="danger" onClick={() => handleDelete(selectedType.id)} />
                            ) : undefined}
                        >
                            <div className="flex flex-col gap-nb-4">
                                {selectedType.is_system && <Alert variant="warning">System template — attributes are read-only</Alert>}

                                <h3 className="text-nb-label text-fg-muted">Attributes</h3>

                                {selectedType.product_type_attributes && selectedType.product_type_attributes.length > 0 ? (
                                    <ul className="flex flex-col divide-y divide-line rounded-nb-lg border border-line">
                                        {selectedType.product_type_attributes.map((attr: ProductTypeAttribute) => (
                                            <li key={attr.id} className="flex items-center justify-between gap-nb-3 p-nb-3">
                                                <div className="flex flex-col gap-nb-1">
                                                    <span className="text-nb-body text-fg">
                                                        {attr.label} <span className="text-nb-caption text-fg-subtle">{attr.field_name}</span>
                                                    </span>
                                                    <div className="flex flex-wrap items-center gap-nb-2">
                                                        <StatusBadge status={attr.field_type} />
                                                        {attr.is_required && <span className="text-nb-caption text-danger">Required</span>}
                                                        {attr.unit && <span className="text-nb-caption text-fg-subtle">{attr.unit}</span>}
                                                        {attr.field_type === 'select' && attr.options && (
                                                            <span className="text-nb-caption text-fg-subtle">{attr.options.length} options</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {canEditSelected && (
                                                    <IconButton label="Delete attribute" icon={<Trash2 size={14} />} variant="danger" size="sm" onClick={() => handleDeleteAttribute(attr.id)} />
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-nb-body text-fg-subtle">No attributes defined</p>
                                )}

                                {canEditSelected && (
                                    showAddAttr ? (
                                        <AttributeEditor
                                            onSave={handleAddAttribute}
                                            onCancel={() => setShowAddAttr(false)}
                                        />
                                    ) : (
                                        <Button variant="secondary" className="w-full" onClick={() => setShowAddAttr(true)}><Plus size={16} /> Add Attribute</Button>
                                    )
                                )}
                            </div>
                        </SettingsCard>
                    ) : (
                        <EmptyState
                            icon={Sliders}
                            title="Select a Product Type"
                            description="Choose a type from the left panel to view and manage its attributes"
                        />
                    )}
                </Grid.Item>
            </Grid>
        </SettingsPageTemplate>
    );
};

export default ProductTypeSettingsPage;
