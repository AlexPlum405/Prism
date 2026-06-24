import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[AppErrorBoundary] Prism render failed', error, errorInfo);
  }

  render() {
    const { children } = this.props;
    const { error, errorInfo } = this.state;

    if (!error) return children;

    return (
      <main
        role="alert"
        style={{
          boxSizing: 'border-box',
          minHeight: '100vh',
          padding: 48,
          color: '#262626',
          background: '#fff',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif',
        }}
      >
        <h1 style={{ margin: '0 0 16px', fontSize: 20 }}>Prism 渲染失败</h1>
        <p style={{ margin: '0 0 24px', color: '#666' }}>
          React 界面渲染时抛出了错误，已保留诊断信息。
        </p>
        <pre
          style={{
            maxHeight: '70vh',
            overflow: 'auto',
            padding: 16,
            border: '1px solid #e6e6e6',
            borderRadius: 8,
            background: '#f7f7f7',
            color: '#262626',
            font: '12px/1.5 SFMono-Regular, Menlo, Consolas, monospace',
            whiteSpace: 'pre-wrap',
          }}
        >
          {error.name}: {error.message}
          {'\n\n'}
          {error.stack}
          {'\n\nComponent stack:\n'}
          {errorInfo?.componentStack}
        </pre>
      </main>
    );
  }
}
