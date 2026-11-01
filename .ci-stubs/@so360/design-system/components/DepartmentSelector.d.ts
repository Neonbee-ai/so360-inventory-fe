import React from 'react';
export interface Department {
    id: string;
    code: string;
    name: string;
    parent_id?: string;
    path: string;
    depth: number;
    is_active: boolean;
    employee_count?: number;
}
export interface DepartmentSelectorProps {
    value?: string;
    onChange: (departmentId: string | null, department?: Department) => void;
    orgId: string;
    tenantId?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    showInactive?: boolean;
    allowClear?: boolean;
}
export declare const DepartmentSelector: React.FC<DepartmentSelectorProps>;
