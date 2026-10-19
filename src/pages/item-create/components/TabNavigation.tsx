import React from 'react';
import { Package, Image, DollarSign, Tag, BarChart3, Truck, Sliders } from 'lucide-react';
import { Tabs } from '@so360/design-system';
import { TabId } from '../../../types/itemTypes';

interface TabItem {
    id: TabId;
    label: string;
    icon: React.ReactNode;
}

const tabs: TabItem[] = [
    { id: 'basic', label: 'Basic Info', icon: <Package size={14} /> },
    { id: 'media', label: 'Media', icon: <Image size={14} /> },
    { id: 'pricing', label: 'Pricing', icon: <DollarSign size={14} /> },
    { id: 'category', label: 'Category', icon: <Tag size={14} /> },
    { id: 'stock', label: 'Stock', icon: <BarChart3 size={14} /> },
    { id: 'shipping', label: 'Shipping', icon: <Truck size={14} /> },
    { id: 'attributes', label: 'Attributes', icon: <Sliders size={14} /> },
];

interface TabNavigationProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
    tabErrors?: Partial<Record<TabId, boolean>>;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange, tabErrors }) => {
    const errored = tabs.filter(t => tabErrors?.[t.id]).map(t => t.id);
    return (
        <div data-testid="item-tab-navigation" data-tab-errors={errored.join(',')}>
            <Tabs
                items={tabs.map(t => ({ id: t.id, label: t.label, icon: t.icon, badge: tabErrors?.[t.id] ? '!' : undefined }))}
                value={activeTab}
                onChange={(id: string) => onTabChange(id as TabId)}
            />
        </div>
    );
};

export default TabNavigation;
