import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ViewModeSwitch } from './ViewModeSwitch';
import { useDocumentStore } from '../store';
import { useSettingsStore } from '../../settings/store';

beforeEach(() => {
  useDocumentStore.setState({ currentDocument: null });
  useSettingsStore.setState({ defaultViewMode: 'split' });
});

describe('ViewModeSwitch', () => {
  it('shows edit, split, and preview controls for Markdown documents', () => {
    useDocumentStore.getState().openDocument('/tmp/readme.md', 'readme.md', '# Readme');

    render(<ViewModeSwitch />);

    expect(screen.getByRole('button', { name: '编辑' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '分栏' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '预览' })).toBeInTheDocument();
  });

  it('hides split and preview controls for plain text documents', () => {
    useDocumentStore.getState().openDocument('/tmp/query.sql', 'query.sql', 'select 1;');

    render(<ViewModeSwitch />);

    expect(screen.getByRole('button', { name: '编辑' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '分栏' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '预览' })).not.toBeInTheDocument();
  });
});
