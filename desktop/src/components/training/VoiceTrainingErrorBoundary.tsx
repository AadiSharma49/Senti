import React from 'react'

interface VoiceTrainingErrorBoundaryProps {
  children: React.ReactNode
}

interface VoiceTrainingErrorBoundaryState {
  hasError: boolean
  message: string
}

export default class VoiceTrainingErrorBoundary extends React.Component<VoiceTrainingErrorBoundaryProps, VoiceTrainingErrorBoundaryState> {
  constructor(props: VoiceTrainingErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      message: 'Voice Configuration Failed To Load',
    }
  }

  static getDerivedStateFromError(): VoiceTrainingErrorBoundaryState {
    return {
      hasError: true,
      message: 'Voice Configuration Failed To Load',
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[VoiceTrainingErrorBoundary] caught error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6 text-center text-white">
          <div className="text-xl font-semibold">Voice Configuration Failed To Load</div>
          <div className="mt-2 text-sm text-red-200">Please close this panel and try again.</div>
        </div>
      )
    }

    return this.props.children
  }
}
