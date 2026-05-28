import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentStore } from '../domains/document/store';
import { useAppDocumentPropertiesModel } from './useAppDocumentPropertiesModel';

const originalDocumentStoreState = useDocumentStore.getState();

describe('useAppDocumentPropertiesModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    useDocumentStore.setState(originalDocumentStoreState, true);
  });

  it('opens and closes the document properties panel', () => {
    const { result } = renderHook(() => useAppDocumentPropertiesModel());

    act(() => {
      result.current.openDocumentProperties();
    });

    expect(result.current.documentPropertiesVisible).toBe(true);

    act(() => {
      result.current.closeDocumentProperties();
    });

    expect(result.current.documentPropertiesVisible).toBe(false);
  });

  it('applies document properties by updating document content', () => {
    const updateContent = vi.fn();
    const originalState = useDocumentStore.getState();
    useDocumentStore.setState({ ...originalState, updateContent });
    const { result } = renderHook(() => useAppDocumentPropertiesModel());

    act(() => {
      result.current.handleApplyDocumentProperties('---\ntitle: Prism\n---\n');
    });

    expect(updateContent).toHaveBeenCalledWith('---\ntitle: Prism\n---\n');
  });
});
