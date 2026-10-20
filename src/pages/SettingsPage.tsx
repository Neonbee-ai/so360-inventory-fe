import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, ChevronRight } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { useAuth } from '../hooks/useAuth';
import CategoryTreeView from '../components/categories/CategoryTreeView';
import { buildCategoryTree } from '../utils/categoryTree';
import ItemAttributeSettingsSection from '../components/settings/ItemAttributeSettingsSection';
import { Alert, Button, IconButton, SettingsCard, SettingsPageTemplate, Skeleton, Switch, TextField, useConfirm } from '@so360/design-system';

interface UomItem {
    id: string;
    name: string;
    abbreviation: string;
}

interface CategoryItem {
    id: string;
    name: string;
    description?: string;
    icon_url?: string | null;
    image_url?: string | null;
    color?: string | null;
    sort_order?: number;
}

interface InventorySettingsData {
    uoms: UomItem[];
    categories: CategoryItem[];
}

const SettingsPage = () => {
    const [confirm, confirmDialog] = useConfirm();
    const navigate = useNavigate();
    const { can } = useAuth();
    const [settings, setSettings] = useState<InventorySettingsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Add UoM state
    const [showAddUom, setShowAddUom] = useState(false);
    const [newUomName, setNewUomName] = useState('');
    const [newUomAbbr, setNewUomAbbr] = useState('');
    const [addingUom, setAddingUom] = useState(false);

    // Add Category state
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryDesc, setNewCategoryDesc] = useState('');
    const [addingCategory, setAddingCategory] = useState(false);

    // Default Logic state
    const [allowNegativeStock, setAllowNegativeStock] = useState(false);
    const [autoApproveTransfers, setAutoApproveTransfers] = useState(false);
    const [togglingLogic, setTogglingLogic] = useState(false);

    const fetchSettings = async () => {
        try {
            setIsLoading(true);
            const [data, defaults] = await Promise.all([
                inventoryService.getSettings(),
                inventoryService.getOrgDefaultLogic().catch(() => ({ allow_negative_stock: false, auto_approve_transfers: false })),
            ]);
            setSettings(data);
            setAllowNegativeStock(defaults.allow_negative_stock);
            setAutoApproveTransfers(defaults.auto_approve_transfers);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleLogic = async (field: 'allow_negative_stock' | 'auto_approve_transfers', value: boolean) => {
        setTogglingLogic(true);
        setError(null);
        try {
            await inventoryService.updateOrgDefaultLogic({ [field]: value });
            if (field === 'allow_negative_stock') setAllowNegativeStock(value);
            else setAutoApproveTransfers(value);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to update setting');
        } finally {
            setTogglingLogic(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleAddUom = async () => {
        if (!newUomName.trim() || !newUomAbbr.trim()) return;
        setAddingUom(true);
        setError(null);
        try {
            await inventoryService.createUom(newUomName.trim(), newUomAbbr.trim());
            setNewUomName('');
            setNewUomAbbr('');
            setShowAddUom(false);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await fetchSettings();
        } catch (err: any) {
            setError(err.message || 'Failed to add unit of measure');
        } finally {
            setAddingUom(false);
        }
    };

    const handleDeleteUom = async (id: string) => {
        if (!(await confirm({ title: 'Delete', message: 'Are you sure you want to delete this unit of measure?', intent: 'danger', confirmLabel: 'Delete' }))) return;
        setError(null);
        try {
            await inventoryService.deleteUom(id);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await fetchSettings();
        } catch (err: any) {
            setError(err.message || 'Failed to delete unit of measure');
        }
    };

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        setAddingCategory(true);
        setError(null);
        try {
            await inventoryService.createCategory(newCategoryName.trim(), newCategoryDesc.trim() || undefined);
            setNewCategoryName('');
            setNewCategoryDesc('');
            setShowAddCategory(false);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await fetchSettings();
        } catch (err: any) {
            setError(err.message || 'Failed to add category');
        } finally {
            setAddingCategory(false);
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!(await confirm({ title: 'Delete', message: 'Are you sure you want to delete this category?', intent: 'danger', confirmLabel: 'Delete' }))) return;
        setError(null);
        try {
            await inventoryService.deleteCategory(id);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            await fetchSettings();
        } catch (err: any) {
            setError(err.message || 'Failed to delete category');
        }
    };

    if (isLoading) return <div className="p-nb-6" aria-busy="true"><Skeleton variant="rect" /></div>;

    return (
        <SettingsPageTemplate trail={[]} title="Inventory Settings" description="Configure units, categories, and module defaults">
            {confirmDialog}
            <div className="flex flex-col gap-nb-4">
                {error && <Alert variant="error">{error}</Alert>}
                {success && <Alert variant="success">Settings updated successfully</Alert>}

                <SettingsCard title="Units of Measure (UoM)" description="Define standard units for stocks and services (e.g., Pcs, KG, Hrs)">
                    <div className="flex flex-wrap gap-nb-2 items-center">
                        {settings?.uoms.map((uom: UomItem) => (
                            <div key={uom.id} className="bg-surface-raised border border-line-strong px-nb-3 py-nb-1 rounded-nb-md text-nb-body text-fg-muted flex items-center gap-nb-2">
                                <span>{uom.name} ({uom.abbreviation})</span>
                                {can('items.update') && (
                                    <IconButton label={`Remove ${uom.name}`} size="sm" variant="danger" icon={<X size={14} />} onClick={() => handleDeleteUom(uom.id)} />
                                )}
                            </div>
                        ))}
                        {showAddUom ? (
                            <div className="flex items-center gap-nb-2">
                                <TextField name="uom-name" aria-label="Unit name" placeholder="Name" value={newUomName} onChange={(e) => setNewUomName(e.target.value)} />
                                <TextField name="uom-abbr" aria-label="Unit abbreviation" placeholder="Abbr" value={newUomAbbr} onChange={(e) => setNewUomAbbr(e.target.value)} />
                                <Button variant="primary" size="sm" onClick={handleAddUom} disabled={addingUom}>{addingUom ? '...' : 'Add'}</Button>
                                <IconButton label="Cancel add unit" size="sm" icon={<X size={16} />} onClick={() => setShowAddUom(false)} />
                            </div>
                        ) : (
                            <Button variant="secondary" size="sm" onClick={() => setShowAddUom(true)}><Plus size={14} /> Add Unit</Button>
                        )}
                    </div>
                </SettingsCard>

                <SettingsCard title="Item Categories">
                    <CategoryTreeView
                        tree={buildCategoryTree(settings?.categories || [])}
                        onAdd={async (name, description, parentId) => {
                            setError(null);
                            try {
                                await inventoryService.createCategory(name, description || undefined, parentId);
                                setSuccess(true);
                                setTimeout(() => setSuccess(false), 3000);
                                await fetchSettings();
                            } catch (err: any) {
                                setError(err.message || 'Failed to add category');
                            }
                        }}
                        onUpdate={async (id, data) => {
                            setError(null);
                            try {
                                await inventoryService.updateCategory(id, data);
                                setSuccess(true);
                                setTimeout(() => setSuccess(false), 3000);
                                await fetchSettings();
                            } catch (err: any) {
                                setError(err.message || 'Failed to update category');
                            }
                        }}
                        onDelete={async (id) => {
                            setError(null);
                            try {
                                await inventoryService.deleteCategory(id);
                                setSuccess(true);
                                setTimeout(() => setSuccess(false), 3000);
                                await fetchSettings();
                            } catch (err: any) {
                                setError(err.message || 'Failed to delete category');
                            }
                        }}
                        canManage={can('items.update')}
                        onSelect={() => {}}
                    />
                </SettingsCard>

                <SettingsCard title="Item Attributes" description="Define custom attributes per category (e.g. Material, Finish, Shelf Life). Values are stored as flexible metadata on each item.">
                    <ItemAttributeSettingsSection
                        categories={settings?.categories || []}
                        canManage={can('items.update')}
                    />
                </SettingsCard>

                <SettingsCard title="Product Types" description="Define product type templates with custom attribute fields (e.g. Electronics, Clothing)">
                    <Button variant="secondary" className="w-full !justify-between" onClick={() => navigate('/inventory/settings/product-types')}>
                        <span className="text-left">
                            <span className="block text-nb-body font-semibold text-fg">Manage Product Types</span>
                            <span className="block text-nb-caption text-fg-subtle">View system templates, create custom types, define attribute schemas</span>
                        </span>
                        <ChevronRight size={18} />
                    </Button>
                </SettingsCard>

                <SettingsCard title="Default Logic">
                    <div className="flex flex-col gap-nb-3">
                        <Switch
                            name="allow-negative-stock"
                            label="Enforce Negative Stock Prevention"
                            description="Block transactions if available quantity would drop below zero"
                            checked={allowNegativeStock}
                            disabled={togglingLogic}
                            onCheckedChange={(v) => handleToggleLogic('allow_negative_stock', v)}
                        />
                        <Switch
                            name="auto-approve-transfers"
                            label="Auto-approve Transfers"
                            description="Mark transfers as Completed immediately after submission"
                            checked={autoApproveTransfers}
                            disabled={togglingLogic}
                            onCheckedChange={(v) => handleToggleLogic('auto_approve_transfers', v)}
                        />
                    </div>
                </SettingsCard>

                <p className="text-nb-caption text-fg-subtle text-center">
                    Note: These settings apply globally to the <b>Neonbee Inventory</b>.
                    Changes may affect ledger calculations and historical reporting.
                </p>
            </div>
        </SettingsPageTemplate>
    );
};

export default SettingsPage;
