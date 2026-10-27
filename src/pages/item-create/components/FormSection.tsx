import React from 'react';
import { FormSection as DsFormSection } from '@so360/design-system';

interface FormSectionProps {
    title: string;
    description?: string;
    children: React.ReactNode;
}

const FormSection: React.FC<FormSectionProps> = ({ title, description, children }) => (
    <DsFormSection title={title} description={description}>
        {children}
    </DsFormSection>
);

export default FormSection;
