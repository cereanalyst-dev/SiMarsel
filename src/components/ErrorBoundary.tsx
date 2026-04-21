import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Caught error in boundary:', error, info.componentStack);
  }

  handleReset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
        <div className="bg-white rounded-[2rem] shadow-xl border border-rose-100 max-w-xl w-full p-10 text-center">
          <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
            Terjadi kesalahan
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Dashboard gagal dirender. Coba muat ulang halaman.
          </p>
          <pre className="text-[11px] text-left bg-slate-50 border border-slate-100 rounded-xl p-4 overflow-auto max-h-40 whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <button
            onClick={this.handleReset}
            className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
