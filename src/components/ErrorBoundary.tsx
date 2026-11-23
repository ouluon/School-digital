import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'មានបញ្ហាបច្ចេកទេសក្នុងកម្មវិធី។',
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-lg p-6 text-center space-y-4">
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
              មានបញ្ហាក្នុងការដំណើរការទិន្នន័យ
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words">
              សូមផ្ទុកទំព័រឡើងវិញ ឬពិនិត្យការភ្ជាប់គណនី Google របស់អ្នក។
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary min-h-[42px] px-5 rounded-xl text-sm font-semibold"
            >
              ផ្ទុកទំព័រឡើងវិញ
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
