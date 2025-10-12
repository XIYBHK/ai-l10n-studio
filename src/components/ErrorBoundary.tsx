import React, { Component, ReactNode } from 'react';
import { Alert, Button } from 'antd';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    log.error('React组件渲染错误', {
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{ padding: '20px' }}>
          <Alert
            message="组件渲染错误"
            description={
              <div>
                <p>
                  <strong>错误信息：</strong>
                  {this.state.error?.message}
                </p>
                {this.state.error?.stack && (
                  <details style={{ marginTop: '10px' }}>
                    <summary>查看详细堆栈</summary>
                    <pre
                      style={{
                        fontSize: '12px',
                        background: '#f5f5f5',
                        padding: '10px',
                        overflow: 'auto',
                        maxHeight: '200px',
                      }}
                    >
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            }
            type="error"
            showIcon
            action={
              <Button size="small" onClick={this.handleReset}>
                重置组件
              </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}
