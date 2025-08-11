import { useEffect, useState } from 'react';

interface LoadingLinesProps {
  messages?: string[];
  count?: number;
  className?: string;
}

export default function LoadingLines({ messages, count = 3, className = '' }: LoadingLinesProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  // Default loading messages if none provided
  const defaultMessages = [
    'Loading...',
    'Please wait...',
    'Almost ready...'
  ];

  const displayMessages = messages || defaultMessages;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % displayMessages.length);
    }, 700);

    return () => clearInterval(interval);
  }, [displayMessages.length]);

  // If count is specified and no messages, show simple skeleton lines
  if (!messages && count) {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="animate-pulse">
            <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded ${
              i === 0 ? 'w-3/4' : i === 1 ? 'w-1/2' : 'w-5/6'
            }`}></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`text-center py-12 ${className}`} data-testid="loading-container">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" data-testid="loading-spinner"></div>
      <div className="space-y-2">
        <p className="text-lg font-medium text-slate-800 dark:text-slate-200" data-testid="loading-message">
          {displayMessages[currentMessageIndex]}
        </p>
        <div className="w-32 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full animate-pulse-soft" 
            style={{ width: '60%' }}
            data-testid="loading-progress"
          ></div>
        </div>
      </div>
    </div>
  );
}
