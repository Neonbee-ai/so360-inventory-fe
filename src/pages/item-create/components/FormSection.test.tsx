import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import FormSection from './FormSection';

describe('FormSection', () => {
  it('When rendered with title / Then shows title text', () => {
    render(<FormSection title="Basic Info"><div>content</div></FormSection>);
    expect(screen.getByText('Basic Info')).toBeInTheDocument();
  });

  it('When rendered with description / Then shows description', () => {
    render(<FormSection title="Section" description="A helpful description"><div>content</div></FormSection>);
    expect(screen.getByText('A helpful description')).toBeInTheDocument();
  });

  it('When rendered without description / Then no description rendered', () => {
    render(<FormSection title="Section"><div>content</div></FormSection>);
    expect(screen.queryByText('A helpful description')).not.toBeInTheDocument();
  });

  it('When rendered / Then renders children', () => {
    render(<FormSection title="Section"><div data-testid="child">child content</div></FormSection>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
