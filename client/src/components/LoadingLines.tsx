import { useEffect, useState } from 'react';

interface LoadingLinesProps {
  messages: string[];
  className?: string;
}

export default function LoadingLines({ messages, className = '' }: LoadingLinesProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 700);

    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className={`text-center py-12 ${className}`} data-testid="loading-container">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" data-testid="loading-spinner"></div>
      <div className="space-y-2">
        <p className="text-lg font-medium text-slate-800" data-testid="loading-message">
          {messages[currentMessageIndex]}
        </p>
        <div className="w-32 h-1 bg-slate-200 rounded-full mx-auto overflow-hidden">
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
