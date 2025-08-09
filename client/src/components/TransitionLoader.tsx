import { useEffect, useState } from 'react';
import { Sparkles, Search, Filter, FileText, Brain, Target, Zap, Star } from 'lucide-react';

interface TransitionLoaderProps {
  fromStep: string;
  toStep: string;
  onComplete: () => void;
  duration?: number;
}

const getStepIcon = (step: string) => {
  switch (step) {
    case 'keywords': return <Search className="h-8 w-8" />;
    case 'confirm': return <Brain className="h-8 w-8" />;
    case 'filters': return <Filter className="h-8 w-8" />;
    case 'results': return <Target className="h-8 w-8" />;
    default: return <Sparkles className="h-8 w-8" />;
  }
};

const getTransitionMessages = (fromStep: string, toStep: string): string[] => {
  const transitions: Record<string, Record<string, string[]>> = {
    keywords: {
      confirm: [
        "🎯 Analyzing your career goals...",
        "🤖 AI is crafting perfect job suggestions...",
        "✨ Finding opportunities that match your dreams...",
        "🚀 Preparing personalized recommendations..."
      ]
    },
    confirm: {
      filters: [
        "🔍 Optimizing search parameters...",
        "⚡ Fine-tuning your preferences...",
        "🎨 Customizing your job hunt experience...",
        "🔧 Preparing advanced filtering options..."
      ]
    },
    filters: {
      results: [
        "🌟 Searching thousands of job opportunities...",
        "🎯 Matching you with perfect positions...",
        "📊 Analyzing job market trends for you...",
        "💼 Curating your personalized job feed..."
      ]
    }
  };

  return transitions[fromStep]?.[toStep] || [
    "✨ Working some magic...",
    "🚀 Preparing something amazing...",
    "🌟 Almost ready...",
    "💫 Finalizing your experience..."
  ];
};

export default function TransitionLoader({ fromStep, toStep, onComplete, duration = 4000 }: TransitionLoaderProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const messages = getTransitionMessages(fromStep, toStep);
  
  useEffect(() => {
    const totalMessages = messages.length;
    const messageInterval = duration / totalMessages;
    
    const messageTimer = setInterval(() => {
      setCurrentMessageIndex((prev) => {
        const next = prev + 1;
        if (next >= totalMessages) {
          clearInterval(messageTimer);
          setTimeout(onComplete, 200);
          return prev;
        }
        return next;
      });
    }, messageInterval);

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        const increment = 100 / (duration / 50);
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(progressTimer);
          return 100;
        }
        return next;
      });
    }, 50);

    return () => {
      clearInterval(messageTimer);
      clearInterval(progressTimer);
    };
  }, [duration, messages.length, onComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center" data-testid="transition-loader">
      <div className="max-w-md w-full mx-auto text-center">
        {/* Animated Icons */}
        <div className="relative mb-8">
          <div className="flex justify-center items-center space-x-8">
            <div className="text-blue-500 opacity-60 transition-all duration-500">
              {getStepIcon(fromStep)}
            </div>
            
            {/* Animated Arrow */}
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            
            <div className="text-purple-500 transition-all duration-500 transform scale-110">
              {getStepIcon(toStep)}
            </div>
          </div>
          
          {/* Sparkle Effect */}
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
            <Sparkles className="h-6 w-6 text-yellow-400 animate-pulse" />
          </div>
        </div>

        {/* Loading Message */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-2 transition-all duration-500" data-testid="transition-message">
            {messages[currentMessageIndex]}
          </h2>
          <p className="text-slate-600">
            Please wait while we prepare everything for you...
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 rounded-full h-3 mb-4 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
            data-testid="transition-progress"
          ></div>
        </div>

        {/* Progress Text */}
        <p className="text-sm text-slate-500" data-testid="transition-progress-text">
          {Math.round(progress)}% complete
        </p>

        {/* Floating Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Star className="absolute top-20 left-10 h-4 w-4 text-yellow-300 animate-pulse" style={{ animationDelay: '0s' }} />
          <Zap className="absolute top-40 right-10 h-5 w-5 text-blue-300 animate-pulse" style={{ animationDelay: '1s' }} />
          <FileText className="absolute bottom-40 left-20 h-4 w-4 text-purple-300 animate-pulse" style={{ animationDelay: '2s' }} />
          <Target className="absolute bottom-20 right-20 h-5 w-5 text-green-300 animate-pulse" style={{ animationDelay: '0.5s' }} />
        </div>
      </div>
    </div>
  );
}