import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import FormSection from './FormSection';

describe('FormSection', () => {
  describe('Given a title-only FormSection', () => {
    it('When rendered / Then shows the title text', () => {
      render(<FormSection title="Basic Info"><div>content</div></FormSection>);
      expect(screen.getByText('Basic Info')).toBeInTheDocument();
    });

    it('When rendered without description / Then no description paragraph is shown', () => {
      render(<FormSection title="Pricing"><div>children</div></FormSection>);
      expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
    });

    it('When rendered / Then renders its children', () => {
      render(<FormSection title="Section"><div data-testid="child">child content</div></FormSection>);
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('When rendered / Then the title is visible', () => {
      render(<FormSection title="Shipping Details"><span>x</span></FormSection>);
      expect(screen.getByText('Shipping Details')).toBeVisible();
    });
  });

  describe('Given a FormSection with a description', () => {
    it('When description is provided / Then shows the description text', () => {
      render(
        <FormSection title="Dimensions" description="Enter package dimensions for accurate shipping quotes">
          <div>dims</div>
        </FormSection>,
      );
      expect(screen.getByText('Enter package dimensions for accurate shipping quotes')).toBeInTheDocument();
    });

    it('When description is provided / Then both title and description are rendered', () => {
      render(
        <FormSection title="Weight" description="Used for shipping cost calculations">
          <input type="number" />
        </FormSection>,
      );
      expect(screen.getByText('Weight')).toBeInTheDocument();
      expect(screen.getByText('Used for shipping cost calculations')).toBeInTheDocument();
    });
  });

  describe('Given multiple children', () => {
    it('When multiple child elements are provided / Then all are rendered', () => {
      render(
        <FormSection title="Multi-child">
          <div data-testid="child-a">A</div>
          <div data-testid="child-b">B</div>
          <div data-testid="child-c">C</div>
        </FormSection>,
      );
      expect(screen.getByTestId('child-a')).toBeInTheDocument();
      expect(screen.getByTestId('child-b')).toBeInTheDocument();
      expect(screen.getByTestId('child-c')).toBeInTheDocument();
    });
  });

  describe('Given different title strings', () => {
    it('When the title is a long string / Then it is fully rendered', () => {
      const longTitle = 'Category Assignment and Hierarchy Configuration';
      render(<FormSection title={longTitle}><span /></FormSection>);
      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });
  });

  describe('Given description is explicitly undefined', () => {
    it('When description prop is omitted / Then renders without crashing', () => {
      expect(() => render(<FormSection title="Test"><div /></FormSection>)).not.toThrow();
    });
  });
});
