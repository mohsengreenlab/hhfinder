import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useWizardStore } from "@/state/wizard";
import { LoginForm } from "@/components/LoginForm";
import { Dashboard } from "@/components/Dashboard";
import { AdminPanel } from "@/components/AdminPanel";
import Home from "@/pages/Home";
import LoadingLines from "@/components/LoadingLines";

interface JobApplication {
  id: number;
  title: string;
  currentStep: number;
  selectedKeywords: string[];
  suggestedKeywords: string[];
  filters: Record<string, any>;
  currentVacancyIndex: number;
  vacancies: any[];
  lastEditedAt: string;
  isCompleted: boolean;
}

interface User {
  id: number;
  username: string;
  isAdmin: boolean;
}

type AppState = 'dashboard' | 'admin' | 'wizard';

function AuthenticatedApp() {
  const { user, isAuthenticated, isLoading, logout, setUser } = useAuth();
  const [appState, setAppState] = useState<AppState>('dashboard');
  const { 
    setCurrentStep, 
    setSelectedKeywords, 
    setSuggestedKeywords, 
    setFilters, 
    setCurrentVacancyIndex, 
    setVacancies, 
    setCurrentApplicationId,
    reset 
  } = useWizardStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-4">
          <LoadingLines count={3} />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onSuccess={setUser} />;
  }

  const handleStartNewApplication = () => {
    reset();
    setCurrentStep(1);
    setAppState('wizard');
  };

  const handleContinueApplication = (application: JobApplication) => {
    // Restore the application state
    setCurrentApplicationId(application.id);
    setCurrentStep(application.currentStep);
    setSelectedKeywords(application.selectedKeywords.map(k => typeof k === 'string' ? { text: k, source: 'custom' as const } : k));
    setSuggestedKeywords(application.suggestedKeywords || []);
    setFilters(application.filters || {});
    setCurrentVacancyIndex(application.currentVacancyIndex || 0);
    setVacancies(application.vacancies || []);
    setAppState('wizard');
  };

  const handleBackToDashboard = () => {
    setAppState('dashboard');
  };

  const handleAdminPanel = () => {
    setAppState('admin');
  };

  switch (appState) {
    case 'admin':
      return <AdminPanel onBack={handleBackToDashboard} />;
    case 'wizard':
      return <Home onBackToDashboard={handleBackToDashboard} />;
    case 'dashboard':
    default:
      return (
        <Dashboard
          user={user}
          onLogout={logout}
          onStartNewApplication={handleStartNewApplication}
          onContinueApplication={handleContinueApplication}
          onAdminPanel={handleAdminPanel}
        />
      );
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthenticatedApp />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
