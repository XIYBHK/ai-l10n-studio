import React, { Component, ReactNode } from 'react';
import i18n from '../i18n/config';
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
    log.error('React component render error', {
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
        <div
          style={{
            margin: '20px',
            padding: '16px',
            border: '1px solid #ffccc7',
            borderRadius: '8px',
            background: '#fff2f0',
            color: '#a8071a',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
            {i18n.t('errorBoundary.title')}
          </div>
          <p style={{ margin: 0 }}>
            <strong>{i18n.t('errorBoundary.errorLabel')}</strong>
            {this.state.error?.message}
          </p>
          {this.state.error?.stack && (
            <details style={{ marginTop: '10px' }}>
              <summary>{i18n.t('errorBoundary.viewStackTrace')}</summary>
              <pre
                style={{
                  fontSize: '12px',
                  background: '#fff',
                  padding: '10px',
                  overflow: 'auto',
                  maxHeight: '200px',
                  borderRadius: '6px',
                  border: '1px solid #ffd8bf',
                }}
              >
                {this.state.error.stack}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReset}
            style={{
              marginTop: '12px',
              border: 'none',
              borderRadius: 'var(--radius-base)',
              background: 'var(--color-error)',
              color: '#fff',
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            {i18n.t('errorBoundary.resetButton')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
