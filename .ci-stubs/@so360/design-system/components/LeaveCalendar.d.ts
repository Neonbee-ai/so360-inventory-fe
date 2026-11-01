import React from 'react';
export interface LeaveRequest {
    id: string;
    person_id: string;
    person_name: string;
    person_avatar?: string;
    leave_type_name: string;
    leave_type_color: string;
    start_date: string;
    end_date: string;
    total_days: number;
    status: 'pending' | 'approved' | 'rejected';
}
export interface LeaveCalendarProps {
    orgId: string;
    tenantId?: string;
    view?: 'month' | 'week';
    departmentId?: string;
    onLeaveClick?: (leave: LeaveRequest) => void;
    className?: string;
}
export declare const LeaveCalendar: React.FC<LeaveCalendarProps>;
