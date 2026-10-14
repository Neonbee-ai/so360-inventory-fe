import React from 'react';
import { Package, Image, DollarSign, Tag, BarChart3, Truck, Sliders } from 'lucide-react';
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
    return (
        <div className="flex gap-1 border-b border-line overflow-x-auto overflow-y-hidden scrollbar-hide rounded-t-xl">
            {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                const hasError = tabErrors?.[tab.id];
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onTabChange(tab.id)}
                        className={`
                            flex items-center gap-1.5 px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all relative
                            ${isActive
                                ? 'text-primary border-b-2 border-primary bg-primary/5'
                                : 'text-fg-subtle hover:text-fg-muted border-b-2 border-transparent'
                            }
                            ${hasError ? 'text-rose-400' : ''}
                        `}
                    >
                        {tab.icon}
                        {tab.label}
                        {hasError && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-2 right-1" />
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default TabNavigation;
