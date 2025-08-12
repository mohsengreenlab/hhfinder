import { useEffect, useState } from 'react';
import { useWizardStore } from '@/state/wizard';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Helper function to clear search queries
function clearSearchQueries(queryClient: any, searchId?: string) {
  // Clear HH search queries (title, description, skills tiers)
  queryClient.removeQueries({ queryKey: ['hh.search.title'] });
  queryClient.removeQueries({ queryKey: ['hh.search.description'] });
  queryClient.removeQueries({ queryKey: ['hh.search.skills'] });
  queryClient.removeQueries({ queryKey: ['hh.search.company_name'] });
  
  // Clear vacancy details
  queryClient.removeQueries({ queryKey: ['hh.vacancy.details'] });
  
  // Clear any merged/paginated result queries
  queryClient.removeQueries({ queryKey: ['/api/hh-search'] });
  
  // Invalidate all queries that might have cached search results
  queryClient.invalidateQueries({ queryKey: ['/api/hh'] });
}

interface BrowserBackHandlerProps {
  onNavigateToStart?: () => void;
}

export function BrowserBackHandler({ onNavigateToStart }: BrowserBackHandlerProps) {
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const { currentStep, resetSearch } = useWizardStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    // Only handle browser back on Steps 2, 3, and 4
    if (!['confirm', 'filters', 'results'].includes(currentStep)) {
      return;
    }

    const handlePopState = (event: PopStateEvent) => {
      // Prevent the default back behavior
      event.preventDefault();
      
      // Push a new state to prevent actual navigation
      window.history.pushState(null, '', window.location.href);
      
      // Show confirmation dialog
      setShowBackConfirm(true);
    };

    // Add an extra state to the history stack so back button triggers our handler
    window.history.pushState(null, '', window.location.href);
    
    // Listen for popstate (back button)
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentStep]);

  const handleConfirmNewSearch = () => {
    // Clear React Query cache
    clearSearchQueries(queryClient);
    
    // Clear wizard state
    resetSearch();
    
    // Navigate to start
    if (onNavigateToStart) {
      onNavigateToStart();
    }
    
    // Show success toast
    toast({
      title: "Started a new search",
      description: "Set your keywords to continue.",
    });
    
    setShowBackConfirm(false);
  };

  return (
    <AlertDialog open={showBackConfirm} onOpenChange={setShowBackConfirm}>
      <AlertDialogContent data-testid="dialog-browser-back-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>Start a new search?</AlertDialogTitle>
          <AlertDialogDescription>
            Your current progress will be cleared. We only save once you reach Step 4.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-browser-back">Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirmNewSearch}
            data-testid="button-confirm-browser-back"
          >
            Start New Search
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function useBrowserBackHandler(onNavigateToStart?: () => void) {
  return { BrowserBackHandler: () => <BrowserBackHandler onNavigateToStart={onNavigateToStart} /> };
}