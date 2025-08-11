import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WizardHeaderProps {
  onHomeClick: () => void;
  currentStep?: string;
}

export default function WizardHeader({ onHomeClick, currentStep }: WizardHeaderProps) {
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
      </div>
    </div>
  );
}