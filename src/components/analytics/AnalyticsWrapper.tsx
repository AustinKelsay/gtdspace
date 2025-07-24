/**
 * @fileoverview React components for analytics integration
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Analytics integration components
 */

import React from 'react';
import { useAnalytics } from '@/services/analytics/AnalyticsCollector';

// === TYPES ===

export interface AnalyticsTrackingConfig {
  category: string;
  action: string;
  label?: string;
}

// === COMPONENTS ===

/**
 * Higher-order component for automatic interaction tracking
 */
export function withAnalytics<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  trackingConfig: AnalyticsTrackingConfig
) {
  return function AnalyticsWrappedComponent(props: P) {
    const { trackInteraction } = useAnalytics();

    const handleClick = () => {
      trackInteraction(
        trackingConfig.label || 'component',
        trackingConfig.action,
        { category: trackingConfig.category }
      );
    };

    return (
      <div onClick={handleClick}>
        <WrappedComponent {...props} />
      </div>
    );
  };
}

/**
 * Analytics tracking provider component
 */
export function AnalyticsTracker({ 
  children, 
  config,
  trigger = 'click'
}: {
  children: React.ReactNode;
  config: AnalyticsTrackingConfig;
  trigger?: 'click' | 'hover' | 'focus';
}) {
  const { trackInteraction } = useAnalytics();

  const handleTracking = () => {
    trackInteraction(
      config.label || 'tracked-element',
      config.action,
      { category: config.category }
    );
  };

  const eventProps = {
    onClick: trigger === 'click' ? handleTracking : undefined,
    onMouseEnter: trigger === 'hover' ? handleTracking : undefined,
    onFocus: trigger === 'focus' ? handleTracking : undefined,
  };

  return (
    <div {...eventProps}>
      {children}
    </div>
  );
}

export default withAnalytics;