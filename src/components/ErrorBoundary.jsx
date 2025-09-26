import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('UI ErrorBoundary:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, color: '#fff', background: '#111827', minHeight: '100vh' }}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong.</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error?.message || this.state.error)}</pre>
          <p style={{ marginTop: 12, opacity: 0.8 }}>Check your .env (VITE_CONTRACT_ADDRESS, VITE_CHAIN_ID) and Localhost 8545 network.</p>
        </div>
      )
    }
    return this.props.children
  }
}
