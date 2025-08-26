/**
 * @fileoverview App loading screen component
 * Shows a loading state while the app initializes
 */

import React from 'react';
import { Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface AppLoadingScreenProps {
  message?: string;
  progress?: number;
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({ 
  message = 'Loading GTD Space...',
  progress 
}) => {
  const [dots, setDots] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background" aria-busy="true">
      <div className="flex flex-col items-center space-y-6">
        {/* Logo/Icon */}
        <div className="relative">
          <Target className="h-20 w-20 text-primary animate-pulse" />
        </div>
        
        {/* Loading message */}
        <div className="text-center space-y-2" role="status" aria-live="polite">
          <h2 className="text-2xl font-semibold">GTD Space</h2>
          <p className="text-muted-foreground">
            {message}
            {'.'.repeat(dots)}
            <span className="invisible">
              {'.'.repeat(3 - dots)}
            </span>
          </p>
        </div>

        {/* Progress bar (optional) */}
        {progress !== undefined && (
          <div className="w-64">
            <Progress value={Math.max(0, Math.min(100, progress))} className="h-2" />
          </div>
        )}
      </div>
    </div>
  );
};

export default AppLoadingScreen;