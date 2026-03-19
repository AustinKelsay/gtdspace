// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

function ExampleCard({ title }: { title: string }) {
  return (
    <section>
      <h1>{title}</h1>
      <button type="button">Save</button>
    </section>
  );
}

describe('test infrastructure (jsdom + RTL)', () => {
  it('renders React components and enables jest-dom matchers', () => {
    render(<ExampleCard title="Test Harness Ready" />);
    expect(screen.getByRole('heading', { name: 'Test Harness Ready' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });
});
