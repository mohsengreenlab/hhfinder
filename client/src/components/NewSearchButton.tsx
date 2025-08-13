import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { useWizardStore } from '@/state/wizard';
import { useToast } from '@/hooks/use-toast';

interface NewSearchButtonProps {
  currentStep: string;
  onNavigateToStart?: () => void;
}

// Helper function to clear all search-related queries
function clearSearchQueries(queryClient: any) {
  // Clear HH search queries (title, description, skills tiers)
  queryClient.removeQueries({ queryKey: ['hh.search.title'] });
  queryClient.removeQueries({ queryKey: ['hh.search.description'] });
  queryClient.removeQueries({ queryKey: ['hh.search.skills'] });
  queryClient.removeQueries({ queryKey: ['hh.search.company_name'] });
  
  // Clear vacancy details
  queryClient.removeQueries({ queryKey: ['hh.vacancy.details'] });
  
  // Clear any merged/paginated result queries
  queryClient.removeQueries({ queryKey: ['/api/hh-search'] });
  queryClient.removeQueries({ queryKey: ['/api/vacancies'] });
  
  // Clear tiered search results (signature-based)
  queryClient.removeQueries({ queryKey: ['/api/vacancies/tiered'] });
  
  // Clear AI keywords cache
  queryClient.removeQueries({ queryKey: ['/api/ai-keywords'] });
  
  // Invalidate all HH-related queries
  queryClient.invalidateQueries({ queryKey: ['/api/hh'] });
  queryClient.invalidateQueries({ queryKey: ['/api/vacancies'] });
}

export default function NewSearchButton({ currentStep, onNavigateToStart }: NewSearchButtonProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { resetSearch } = useWizardStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleNewSearch = () => {
    // Get current state for logging
    const currentState = useWizardStore.getState();
    const oldSignature = currentState.currentSearchSignature;
    
    console.log(`NewSearch clicked at step ${currentStep}, old signature=${oldSignature}`);
    
    // Clear React Query cache FIRST
    console.log('React Query invalidated: [/api/vacancies], [/api/ai-keywords], [/api/hh]');
    clearSearchQueries(queryClient);
    
    // Clear wizard state and generate new signature
    resetSearch();
    
    // Get new signature after reset
    const newState = useWizardStore.getState();
    const newSignature = newState.currentSearchSignature;
    
    console.log(`New signature generated: ${newSignature}`);
    console.log('Wizard reset complete; persisted store cleared');
    
    // Navigate to start
    if (onNavigateToStart) {
      onNavigateToStart();
    }
    
    // Show success toast
    toast({
      title: "Started a new search",
      description: "Set your keywords to continue.",
    });
    
    setShowConfirmDialog(false);
  };

  return (
    <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="flex items-center gap-2"
          data-testid="button-new-search"
        >
          <RotateCcw className="h-4 w-4" />
          New Search
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="dialog-new-search-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>Start a new search?</AlertDialogTitle>
          <AlertDialogDescription>
            Your current progress will be cleared. We only save once you reach Step 4.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-new-search">Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleNewSearch}
            data-testid="button-confirm-new-search"
          >
            Start New Search
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}