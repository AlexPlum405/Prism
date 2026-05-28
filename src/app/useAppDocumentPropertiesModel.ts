import { useCallback, useState } from 'react';
import { useDocumentStore } from '../domains/document/store';

export function useAppDocumentPropertiesModel() {
  const [documentPropertiesVisible, setDocumentPropertiesVisible] = useState(false);

  const closeDocumentProperties = useCallback(() => {
    setDocumentPropertiesVisible(false);
  }, []);

  const openDocumentProperties = useCallback(() => {
    setDocumentPropertiesVisible(true);
  }, []);

  const handleApplyDocumentProperties = useCallback((content: string) => {
    useDocumentStore.getState().updateContent(content);
  }, []);

  return {
    closeDocumentProperties,
    documentPropertiesVisible,
    handleApplyDocumentProperties,
    openDocumentProperties,
  };
}
