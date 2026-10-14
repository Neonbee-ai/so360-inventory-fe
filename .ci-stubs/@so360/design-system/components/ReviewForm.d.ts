import React from 'react';
export interface ReviewTemplate {
    sections: Array<{
        id: string;
        title: string;
        description?: string;
        weight?: number;
        fields: Array<{
            type: 'rating' | 'textarea' | 'text' | 'number' | 'checkbox';
            label: string;
            max?: number;
            required?: boolean;
        }>;
    }>;
    rating_scale: number;
    rating_labels?: Record<number, string>;
}
export interface ReviewFormProps {
    template: ReviewTemplate;
    initialData?: Record<string, any>;
    onChange: (data: Record<string, any>) => void;
    disabled?: boolean;
    className?: string;
}
export declare const ReviewForm: React.FC<ReviewFormProps>;
