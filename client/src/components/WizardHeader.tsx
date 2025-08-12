import { Home, Save, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWizardStore } from '@/state/wizard';
import NewSearchButton from '@/components/NewSearchButton';

interface WizardHeaderProps {
  onHomeClick: () => void;
  onNavigateToStart?: () => void;
  currentStep?: string;
}

export default function WizardHeader({ onHomeClick, onNavigateToStart, currentStep }: WizardHeaderProps) {
  const { isSaving, lastSavedAt, currentApplicationId, hasReachedStep4 } = useWizardStore();
  
  const getStepTitle = (step?: string) => {
    switch (step) {
      case 'keywords':
        return 'Step 1: Keywords';
      case 'confirm':
        return 'Step 2: Confirm';
      case 'filters':
        return 'Step 3: Filters';
      case 'results':
        return 'Step 4: Results';
      default:
        return 'Job Search';
    }
  };

  const formatLastSaved = (date: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Saved now';
    if (minutes === 1) return 'Saved 1 minute ago';
    return `Saved ${minutes} minutes ago`;
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onHomeClick}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Home
          </Button>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {getStepTitle(currentStep)}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* New Search button for Steps 2, 3, and 4 */}
          {currentStep && ['confirm', 'filters', 'results'].includes(currentStep) && (
            <NewSearchButton 
              currentStep={currentStep} 
              onNavigateToStart={onNavigateToStart}
            />
          )}
          
          {/* Auto-save indicator */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            {!hasReachedStep4 ? (
              <span>Not saved yet</span>
            ) : currentApplicationId && isSaving ? (
              <>
                <Save className="h-4 w-4 animate-pulse text-blue-500" />
                <span>Saving...</span>
              </>
            ) : currentApplicationId && lastSavedAt ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{formatLastSaved(lastSavedAt)}</span>
              </>
            ) : hasReachedStep4 ? (
              <span>Auto-save enabled</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}