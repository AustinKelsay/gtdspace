/**
 * @fileoverview In-app user feedback collection widget
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - In-app feedback and support system
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  MessageSquare, 
  Star, 
  Bug, 
  Lightbulb, 
  Heart, 
  Send, 
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Smartphone,
  Monitor,
  Laptop
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// === TYPES ===

/**
 * Feedback types with different handling
 */
export type FeedbackType = 'bug' | 'feature' | 'general' | 'praise' | 'question';

/**
 * Feedback priority levels
 */
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Feedback status for tracking
 */
export type FeedbackStatus = 'pending' | 'reviewing' | 'in-progress' | 'resolved' | 'closed';

/**
 * User feedback data structure
 */
export interface UserFeedback {
  /** Unique feedback ID */
  id: string;
  /** Feedback type */
  type: FeedbackType;
  /** Priority level */
  priority: FeedbackPriority;
  /** Current status */
  status: FeedbackStatus;
  /** Feedback title/subject */
  title: string;
  /** Detailed feedback content */
  content: string;
  /** User rating (1-5 stars) */
  rating?: number;
  /** User email for follow-up */
  email?: string;
  /** User's current context */
  context: FeedbackContext;
  /** System information */
  systemInfo: SystemInfo;
  /** Timestamp when submitted */
  timestamp: number;
  /** Screenshots or attachments */
  attachments?: FeedbackAttachment[];
  /** User consent for follow-up */
  allowFollowUp: boolean;
}

/**
 * Context information when feedback was submitted
 */
export interface FeedbackContext {
  /** Current page/route */
  currentPage: string;
  /** Active features */
  activeFeatures: string[];
  /** Recent actions */
  recentActions: string[];
  /** Open files */
  openFiles: number;
  /** Current editor mode */
  editorMode?: string;
  /** User session duration */
  sessionDuration: number;
}

/**
 * System information for debugging
 */
export interface SystemInfo {
  /** User agent */
  userAgent: string;
  /** Screen resolution */
  screenResolution: string;
  /** App version */
  appVersion: string;
  /** Platform */
  platform: string;
  /** Memory usage */
  memoryUsage?: number;
  /** Performance metrics */
  performanceMetrics?: Record<string, number>;
}

/**
 * Feedback attachment
 */
export interface FeedbackAttachment {
  /** Attachment type */
  type: 'screenshot' | 'log' | 'file';
  /** File name */
  name: string;
  /** File data */
  data: string | ArrayBuffer;
  /** File size in bytes */
  size: number;
}

/**
 * Feedback widget configuration
 */
export interface FeedbackWidgetConfig {
  /** Widget position */
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Show rating for feedback types */
  showRating: boolean;
  /** Collect system information */
  collectSystemInfo: boolean;
  /** Allow screenshot capture */
  allowScreenshots: boolean;
  /** Maximum feedback length */
  maxContentLength: number;
  /** Show feedback history */
  showHistory: boolean;
  /** Auto-collect context */
  autoCollectContext: boolean;
}

// === CONSTANTS ===

const FEEDBACK_TYPES: Record<FeedbackType, { 
  label: string; 
  icon: React.ComponentType<any>; 
  color: string;
  description: string;
}> = {
  bug: { 
    label: 'Bug Report', 
    icon: Bug, 
    color: 'text-red-600',
    description: 'Report issues, errors, or unexpected behavior'
  },
  feature: { 
    label: 'Feature Request', 
    icon: Lightbulb, 
    color: 'text-yellow-600',
    description: 'Suggest new features or improvements'
  },
  general: { 
    label: 'General Feedback', 
    icon: MessageSquare, 
    color: 'text-blue-600',
    description: 'Share your thoughts and suggestions'
  },
  praise: { 
    label: 'Compliment', 
    icon: Heart, 
    color: 'text-pink-600',
    description: 'Tell us what you love about the app'
  },
  question: { 
    label: 'Question', 
    icon: AlertCircle, 
    color: 'text-purple-600',
    description: 'Ask questions about features or usage'
  }
};

const PRIORITY_LEVELS: Record<FeedbackPriority, { 
  label: string; 
  color: string;
  description: string;
}> = {
  low: { 
    label: 'Low', 
    color: 'bg-gray-500',
    description: 'Nice to have, no rush'
  },
  medium: { 
    label: 'Medium', 
    color: 'bg-blue-500',
    description: 'Important but not urgent'
  },
  high: { 
    label: 'High', 
    color: 'bg-orange-500',
    description: 'Should be addressed soon'
  },
  critical: { 
    label: 'Critical', 
    color: 'bg-red-500',
    description: 'Blocks important functionality'
  }
};

const STATUS_INFO: Record<FeedbackStatus, {
  label: string;
  icon: React.ComponentType<any>;
  color: string;
}> = {
  pending: { label: 'Pending', icon: Clock, color: 'text-gray-500' },
  reviewing: { label: 'Under Review', icon: AlertCircle, color: 'text-blue-500' },
  'in-progress': { label: 'In Progress', icon: Clock, color: 'text-orange-500' },
  resolved: { label: 'Resolved', icon: CheckCircle, color: 'text-green-500' },
  closed: { label: 'Closed', icon: X, color: 'text-gray-400' }
};

// === FEEDBACK WIDGET ===

/**
 * In-app feedback collection widget
 */
export function FeedbackWidget({ 
  config = {
    position: 'bottom-right',
    showRating: true,
    collectSystemInfo: true,
    allowScreenshots: false,
    maxContentLength: 2000,
    showHistory: true,
    autoCollectContext: true
  }
}: {
  config?: Partial<FeedbackWidgetConfig>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<'type' | 'form' | 'success'>('type');
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    email: '',
    rating: 0,
    priority: 'medium' as FeedbackPriority,
    allowFollowUp: true
  });
  const [submittedFeedback, setSubmittedFeedback] = useState<UserFeedback[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  /**
   * Reset form state
   */
  const resetForm = () => {
    setCurrentStep('type');
    setSelectedType(null);
    setFormData({
      title: '',
      content: '',
      email: '',
      rating: 0,
      priority: 'medium',
      allowFollowUp: true
    });
  };

  /**
   * Collect current context information
   */
  const collectContext = (): FeedbackContext => {
    if (!config.autoCollectContext) {
      return {
        currentPage: 'unknown',
        activeFeatures: [],
        recentActions: [],
        openFiles: 0,
        sessionDuration: 0
      };
    }

    return {
      currentPage: window.location.pathname,
      activeFeatures: ['editor', 'file-manager'], // Would be dynamic
      recentActions: ['file-open', 'text-edit'], // Would be from analytics
      openFiles: 5, // Would be from tab manager
      editorMode: 'wysiwyg', // Would be from editor state
      sessionDuration: Date.now() - performance.timing.navigationStart
    };
  };

  /**
   * Collect system information
   */
  const collectSystemInfo = (): SystemInfo => {
    const info: SystemInfo = {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      appVersion: process.env.VITE_APP_VERSION || '1.0.0',
      platform: navigator.platform
    };

    if (config.collectSystemInfo && (performance as any).memory) {
      info.memoryUsage = Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024);
      info.performanceMetrics = {
        loadTime: 0, // Would be calculated from performance API
        domReady: 0  // Would be calculated from performance API
      };
    }

    return info;
  };

  /**
   * Submit feedback
   */
  const submitFeedback = async () => {
    if (!selectedType || !formData.content.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const feedback: UserFeedback = {
        id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: selectedType,
        priority: formData.priority,
        status: 'pending',
        title: formData.title || `${FEEDBACK_TYPES[selectedType].label} - ${new Date().toLocaleDateString()}`,
        content: formData.content,
        rating: formData.rating > 0 ? formData.rating : undefined,
        email: formData.email || undefined,
        context: collectContext(),
        systemInfo: collectSystemInfo(),
        timestamp: Date.now(),
        allowFollowUp: formData.allowFollowUp
      };

      // In a real implementation, this would be sent to a backend service
      console.log('Feedback submitted:', feedback);
      
      // Store locally for demonstration
      setSubmittedFeedback(prev => [feedback, ...prev]);

      // Show success
      setCurrentStep('success');
      
      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback! We'll review it soon.",
      });

      // Auto-close after success
      setTimeout(() => {
        setIsOpen(false);
        resetForm();
      }, 2000);

    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast({
        title: "Submission Failed",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Get widget position styles
   */
  const getPositionStyles = () => {
    const baseStyles = "fixed z-50";
    switch (config.position) {
      case 'bottom-right':
        return `${baseStyles} bottom-4 right-4`;
      case 'bottom-left':
        return `${baseStyles} bottom-4 left-4`;
      case 'top-right':
        return `${baseStyles} top-4 right-4`;
      case 'top-left':
        return `${baseStyles} top-4 left-4`;
      default:
        return `${baseStyles} bottom-4 right-4`;
    }
  };

  return (
    <div className={getPositionStyles()}>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            className="rounded-full shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => setIsOpen(true)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Feedback
          </Button>
        </DialogTrigger>
        
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Share Your Feedback
            </DialogTitle>
            <DialogDescription>
              Help us improve GTD Space by sharing your thoughts, reporting issues, or suggesting features.
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Select Feedback Type */}
          {currentStep === 'type' && (
            <div className="space-y-4">
              <div className="grid gap-3">
                {Object.entries(FEEDBACK_TYPES).map(([type, info]) => {
                  const Icon = info.icon;
                  return (
                    <Card
                      key={type}
                      className={`cursor-pointer transition-colors hover:bg-accent ${
                        selectedType === type ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedType(type as FeedbackType)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Icon className={`h-5 w-5 mt-0.5 ${info.color}`} />
                          <div className="flex-1">
                            <h3 className="font-medium">{info.label}</h3>
                            <p className="text-sm text-muted-foreground">{info.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setCurrentStep('form')}
                  disabled={!selectedType}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Feedback Form */}
          {currentStep === 'form' && selectedType && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-accent rounded-lg">
                {React.createElement(FEEDBACK_TYPES[selectedType].icon, {
                  className: `h-4 w-4 ${FEEDBACK_TYPES[selectedType].color}`
                })}
                <span className="font-medium">{FEEDBACK_TYPES[selectedType].label}</span>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <Label htmlFor="title">Title (Optional)</Label>
                  <Input
                    id="title"
                    placeholder={`Brief summary of your ${selectedType}`}
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    maxLength={100}
                  />
                </div>

                {/* Content */}
                <div>
                  <Label htmlFor="content">
                    Details <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="content"
                    placeholder={`Please provide detailed information about your ${selectedType}...`}
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    maxLength={config.maxContentLength}
                    rows={4}
                    className="resize-none"
                  />
                  <div className="text-xs text-muted-foreground text-right">
                    {formData.content.length}/{config.maxContentLength}
                  </div>
                </div>

                {/* Rating */}
                {config.showRating && (selectedType === 'general' || selectedType === 'praise') && (
                  <div>
                    <Label>Rating (Optional)</Label>
                    <div className="flex gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Button
                          key={star}
                          variant="ghost"
                          size="sm"
                          className="p-1"
                          onClick={() => setFormData(prev => ({ ...prev, rating: star }))}
                        >
                          <Star
                            className={`h-5 w-5 ${
                              star <= formData.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground'
                            }`}
                          />
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Priority */}
                {selectedType === 'bug' && (
                  <div>
                    <Label>Priority Level</Label>
                    <div className="flex gap-2 mt-2">
                      {Object.entries(PRIORITY_LEVELS).map(([level, info]) => (
                        <Button
                          key={level}
                          variant={formData.priority === level ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFormData(prev => ({ ...prev, priority: level as FeedbackPriority }))}
                        >
                          <Badge className={`mr-2 ${info.color} text-white`} />
                          {info.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact Information */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                      <span className="text-sm font-medium">Contact Information (Optional)</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 mt-3">
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        We'll only use this to follow up on your feedback if needed.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="followUp"
                        checked={formData.allowFollowUp}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, allowFollowUp: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="followUp" className="text-sm">
                        Allow follow-up communication about this feedback
                      </Label>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* System Info Notice */}
                {config.collectSystemInfo && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium mb-1">System Information</p>
                        <p>Basic system information (browser, screen size, app version) will be included to help us debug issues. No personal data is collected.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('type')}
                >
                  Back
                </Button>
                <Button
                  onClick={submitFeedback}
                  disabled={!formData.content.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Feedback
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {currentStep === 'success' && (
            <div className="text-center space-y-4 py-8">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Thank You!</h3>
                <p className="text-muted-foreground">
                  Your feedback has been submitted successfully. We appreciate you taking the time to help us improve GTD Space.
                </p>
              </div>
            </div>
          )}

          {/* Feedback History */}
          {config.showHistory && submittedFeedback.length > 0 && currentStep === 'type' && (
            <div className="mt-6">
              <Separator className="mb-4" />
              <div>
                <h4 className="font-medium mb-3">Your Recent Feedback</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {submittedFeedback.slice(0, 3).map((feedback) => {
                    const StatusIcon = STATUS_INFO[feedback.status].icon;
                    return (
                      <div key={feedback.id} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                        <StatusIcon className={`h-4 w-4 ${STATUS_INFO[feedback.status].color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{feedback.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(feedback.timestamp).toLocaleDateString()} • {STATUS_INFO[feedback.status].label}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {FEEDBACK_TYPES[feedback.type].label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === UTILITY COMPONENTS ===

/**
 * Feedback status indicator
 */
export function FeedbackStatus({ status }: { status: FeedbackStatus }) {
  const info = STATUS_INFO[status];
  const Icon = info.icon;
  
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${info.color}`} />
      <span className="text-sm">{info.label}</span>
    </div>
  );
}

/**
 * Feedback type badge
 */
export function FeedbackTypeBadge({ type }: { type: FeedbackType }) {
  const info = FEEDBACK_TYPES[type];
  const Icon = info.icon;
  
  return (
    <Badge variant="outline" className="flex items-center gap-1">
      <Icon className={`h-3 w-3 ${info.color}`} />
      {info.label}
    </Badge>
  );
}

/**
 * System information display
 */
export function SystemInfoDisplay({ systemInfo }: { systemInfo: SystemInfo }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getDeviceIcon = () => {
    const ua = systemInfo.userAgent.toLowerCase();
    if (ua.includes('mobile')) return Smartphone;
    if (ua.includes('tablet')) return Smartphone;
    if (ua.includes('mac')) return Laptop;
    return Monitor;
  };

  const DeviceIcon = getDeviceIcon();

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between">
          <div className="flex items-center gap-2">
            <DeviceIcon className="h-4 w-4" />
            <span className="text-sm">System Information</span>
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-2 p-3 bg-muted rounded-lg">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="font-medium">Platform:</span>
            <span className="ml-2">{systemInfo.platform}</span>
          </div>
          <div>
            <span className="font-medium">Screen:</span>
            <span className="ml-2">{systemInfo.screenResolution}</span>
          </div>
          <div>
            <span className="font-medium">App Version:</span>
            <span className="ml-2">{systemInfo.appVersion}</span>
          </div>
          {systemInfo.memoryUsage && (
            <div>
              <span className="font-medium">Memory:</span>
              <span className="ml-2">{systemInfo.memoryUsage}MB</span>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default FeedbackWidget;