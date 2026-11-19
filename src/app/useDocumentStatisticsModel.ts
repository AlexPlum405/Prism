import { useCallback, useState } from 'react';

/**
 * 统计是「按需查看」的信息，不常驻状态栏。
 * 这里只负责开关，统计数值来自已有的 writingStats 模型，避免重复计算。
 */
export function useDocumentStatisticsModel() {
  const [statisticsVisible, setStatisticsVisible] = useState(false);

  const openDocumentStatistics = useCallback(() => {
    setStatisticsVisible(true);
  }, []);

  const closeDocumentStatistics = useCallback(() => {
    setStatisticsVisible(false);
  }, []);

  return {
    statisticsVisible,
    openDocumentStatistics,
    closeDocumentStatistics,
  };
}
