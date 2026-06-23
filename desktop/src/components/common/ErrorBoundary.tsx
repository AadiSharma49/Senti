import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  name?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name || 'root'}]`, error.message, error.stack, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: '#0a0a0f',
          color: '#ff6060',
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          padding: '40px',
          boxSizing: 'border-box'
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#ff4040' }}>
            COMPONENT CRASH DETECTED
          </h1>
          <div style={{
            background: '#1a1a2e',
            border: '1px solid #ff404040',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '600px',
            width: '100%',
            marginBottom: '12px'
          }}>
            <div style={{ color: '#ff8080', fontSize: '0.8rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Location: {this.props.name || 'root'}
            </div>
            <div style={{ color: '#ff6060', fontSize: '0.9rem', wordBreak: 'break-word' }}>
              {this.state.error?.message || 'Unknown error'}
            </div>
          </div>
          <div style={{
            color: '#9090a8',
            fontSize: '0.7rem',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '300px',
            overflow: 'auto'
          }}>
            {this.state.error?.stack}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}