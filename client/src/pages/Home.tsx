import { useWizardStore } from '@/state/wizard';
import Step1Keywords from '@/steps/Step1Keywords';
import Step2Confirm from '@/steps/Step2Confirm';
import Step3Filters from '@/steps/Step3Filters';
import Step4Viewer from '@/steps/Step4Viewer';
import TransitionLoader from '@/components/TransitionLoader';
import WizardHeader from '@/components/WizardHeader';

interface HomeProps {
  onBackToDashboard?: () => void;
}

export default function Home({ onBackToDashboard }: HomeProps = {}) {
  const { currentStep, isTransitioning, transitionFrom, transitionTo, completeTransition } = useWizardStore();

  // Show transition loader during transitions
  if (isTransitioning && transitionFrom && transitionTo) {
    return (
      <TransitionLoader
        fromStep={transitionFrom}
        toStep={transitionTo}
        onComplete={completeTransition}
        duration={4000}
      />
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'keywords':
        return <Step1Keywords onBackToDashboard={onBackToDashboard} />;
      case 'confirm':
        return <Step2Confirm onBackToDashboard={onBackToDashboard} />;
      case 'filters':
        return <Step3Filters onBackToDashboard={onBackToDashboard} />;
      case 'results':
        return <Step4Viewer onBackToDashboard={onBackToDashboard} />;
      default:
        return <Step1Keywords onBackToDashboard={onBackToDashboard} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <WizardHeader 
        onHomeClick={onBackToDashboard || (() => {})} 
        currentStep={currentStep}
      />
      <div className="pt-16 min-h-screen flex items-center justify-center p-4">
        {renderStep()}
      </div>
    </div>
  );
}
