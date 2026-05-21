import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import FormSection from './FormSection';

describe('Given FormSection', () => {
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

describe('Given FormSection display variants', () => {
  it('When rendered / Then title has uppercase styling via className', () => {
    const { container } = render(<FormSection title="Inventory"><span /></FormSection>);
    const heading = container.querySelector('h3');
    expect(heading).not.toBeNull();
    expect(heading!.className).toContain('uppercase');
  });

  it('When rendered with long title / Then title is still visible in DOM', () => {
    const longTitle = 'A Very Long Section Title That Should Still Render Correctly';
    render(<FormSection title={longTitle}><div /></FormSection>);
    expect(screen.getByText(longTitle)).toBeInTheDocument();
  });

  it('When rendered with multiple children / Then all children appear', () => {
    render(
      <FormSection title="Multi">
        <div data-testid="child-a">A</div>
        <div data-testid="child-b">B</div>
      </FormSection>
    );
    expect(screen.getByTestId('child-a')).toBeInTheDocument();
    expect(screen.getByTestId('child-b')).toBeInTheDocument();
  });
});
