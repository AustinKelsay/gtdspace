/**
 * @fileoverview Google Calendar integration settings component
 * @author Development Team
 * @created 2025-01-23
 */

import React, { useState, useEffect } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, RefreshCw, Link2, Link2Off, Clock, AlertCircle, Settings, Eye, EyeOff } from 'lucide-react';
import type { SyncStatus } from '@/types/google-calendar';
import { cn } from '@/lib/utils';

export const GoogleCalendarSettings: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const { toast } = useToast();

  // OAuth Configuration state
  const [oauthConfig, setOauthConfig] = useState<{client_id: string; client_secret: string} | null>(null);
  const [hasConfig, setHasConfig] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    client_secret: ''
  });

  /**
   * Safely truncate a string to a maximum length, only adding ellipsis when needed
   */
  const truncateString = (str: string | undefined, maxLength: number): string => {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return `${str.slice(0, maxLength)}...`;
  };

  /**
   * Validate form data for OAuth configuration
   */
  const isFormValid = (): boolean => {
    const clientId = formData.client_id.trim();
    const clientSecret = formData.client_secret.trim();
    
    if (!clientId || !clientSecret) return false;
    if (!clientId.endsWith('.apps.googleusercontent.com')) return false;
    
    return true;
  };

  // Load status and config on mount
  useEffect(() => {
    checkAuthStatus();
    loadOAuthConfig();
  }, []);

  /**
   * Load OAuth configuration from secure storage
   */
  const loadOAuthConfig = async () => {
    try {
      const hasConfigResult = await safeInvoke<boolean>('google_oauth_has_config', undefined, false);
      setHasConfig(hasConfigResult);
      
      if (hasConfigResult) {
        const config = await safeInvoke<{client_id: string; client_secret: string} | null>('google_oauth_get_config', undefined, null);
        if (config) {
          setOauthConfig(config);
          setFormData({
            client_id: config.client_id,
            client_secret: config.client_secret
          });
        }
      }
    } catch (error) {
      console.error('[GoogleCalendarSettings] Failed to load OAuth config:', error);
    }
  };

  /**
   * Save OAuth configuration to secure storage
   */
  const handleSaveConfig = async () => {
    const clientId = formData.client_id.trim();
    const clientSecret = formData.client_secret.trim();
    
    if (!clientId || !clientSecret) {
      toast({
        title: 'Validation Error',
        description: 'Both Client ID and Client Secret are required.',
        variant: 'destructive',
      });
      return;
    }
    
    // Basic validation for Google OAuth Client ID format
    if (!clientId.endsWith('.apps.googleusercontent.com')) {
      toast({
        title: 'Validation Error',
        description: 'Invalid Client ID format. Expected format: xxx.apps.googleusercontent.com',
        variant: 'destructive',
      });
      return;
    }

    setIsConfiguring(true);
    try {
      await safeInvoke('google_oauth_store_config', {
        clientId: clientId,
        clientSecret: clientSecret
      });

      setOauthConfig({
        client_id: clientId,
        client_secret: clientSecret
      });
      setHasConfig(true);

      toast({
        title: 'Configuration Saved',
        description: 'Google OAuth credentials have been stored securely.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error as string,
        variant: 'destructive',
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  /**
   * Clear OAuth configuration from secure storage
   */
  const handleClearConfig = async () => {
    setIsConfiguring(true);
    try {
      await safeInvoke('google_oauth_clear_config');
      
      setOauthConfig(null);
      setHasConfig(false);
      setFormData({
        client_id: '',
        client_secret: ''
      });

      toast({
        title: 'Configuration Cleared',
        description: 'Google OAuth credentials have been removed.',
      });
    } catch (error) {
      toast({
        title: 'Clear Failed',
        description: error as string,
        variant: 'destructive',
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  /**
   * Checks whether the user is authenticated with Google Calendar.
   * Updates the local sync status when authenticated and returns a boolean result.
   */
  const checkAuthStatus = async (): Promise<boolean> => {
    try {
      const isAuthenticated = await safeInvoke<boolean>('google_calendar_is_authenticated', undefined, false);
      console.log('[GoogleCalendarSettings] Authentication status:', isAuthenticated);

      if (isAuthenticated) {
        const lastSync = localStorage.getItem('google-calendar-last-sync');
        setSyncStatus({
          isConnected: true,
          lastSync: lastSync,
          syncInProgress: false,
          error: null
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('[GoogleCalendarSettings] Failed to check auth status:', error);
      return false;
    }
  };


  /**
   * Initiates the OAuth flow. Marks progress, then verifies auth via checkAuthStatus.
   * Only sets connected when verification succeeds; otherwise clears progress and sets error.
   */
  const handleConnect = async () => {
    console.log('[GoogleCalendarSettings] Starting connection process...');

    setIsConnecting(true);
    try {
      console.log('[GoogleCalendarSettings] Invoking google_calendar_start_auth command...');
      const result = await safeInvoke<string>('google_calendar_start_auth', undefined, null);
      if (!result) {
        throw new Error('Failed to start authentication');
      }
      console.log('[GoogleCalendarSettings] Auth started:', result);

      // Indicate auth is in progress via sync status until verified
      setSyncStatus(prev => prev ? {
        ...prev,
        syncInProgress: true,
        error: null
      } : {
        isConnected: false,
        lastSync: null,
        syncInProgress: true,
        error: null
      });

      // Verify authentication status before marking connected
      const authenticated = await checkAuthStatus();
      if (authenticated) {
        toast({
          title: 'Google Calendar Connected',
          description: result,
        });
      } else {
        setSyncStatus(prev => prev ? {
          ...prev,
          syncInProgress: false,
          error: 'Authorization not completed. Please finish signing in via your browser.'
        } : {
          isConnected: false,
          lastSync: null,
          syncInProgress: false,
          error: 'Authorization not completed. Please finish signing in via your browser.'
        });
      }
    } catch (error) {
      console.error('[GoogleCalendarSettings] Connection failed:', error);

      // Check if the error contains a URL (manual fallback)
      const errorStr = String(error);
      if (errorStr.includes('http')) {
        // Extract URL from error message
        const urlMatch = errorStr.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          const authUrl = urlMatch[1];

          // Show a dialog with the URL
          toast({
            title: 'Browser Opening Failed',
            description: `Please open this URL manually in your browser: ${authUrl}`,
          });

          // Also log the URL for easy copying
          console.log('[GoogleCalendarSettings] Manual auth URL:', authUrl);
        } else {
          toast({
            title: 'Connection Failed',
            description: errorStr,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Connection Failed',
          description: errorStr,
          variant: 'destructive',
        });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await safeInvoke('google_calendar_disconnect_simple', undefined, null);

      // Clear local state
      setSyncStatus({
        isConnected: false,
        lastSync: null,
        syncInProgress: false,
        error: null
      });

      // Clear stored events
      localStorage.removeItem('google-calendar-events');

      toast({
        title: 'Google Calendar Disconnected',
        description: 'Your Google Calendar account has been disconnected.',
      });
    } catch (error) {
      toast({
        title: 'Disconnect Failed',
        description: error as string,
        variant: 'destructive',
      });
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const events = await safeInvoke('google_calendar_fetch_events', undefined, null);
      console.log('[GoogleCalendarSettings] Fetched events:', events);

      // Store events in localStorage for now (until we have proper state management)
      if (Array.isArray(events)) {
        localStorage.setItem('google-calendar-events', JSON.stringify(events));

        // Store last sync time
        const now = new Date().toISOString();
        localStorage.setItem('google-calendar-last-sync', now);

        // Update UI - guard against null prev
        setSyncStatus(prev => prev ? {
          ...prev,
          lastSync: now,
          syncInProgress: false,
          error: null
        } : {
          isConnected: true,  // Successful sync means we're connected
          syncInProgress: false,
          lastSync: now,
          error: null
        });

        toast({
          title: 'Calendar Synced',
          description: `Successfully synced ${events.length} events from Google Calendar.`,
        });

        // Dispatch event for calendar view to update
        window.dispatchEvent(new CustomEvent('google-calendar-synced', {
          detail: events
        }));
      }
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: error as string,
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (lastSync?: string) => {
    if (!lastSync) return 'Never';

    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <div>
          <h3 className="text-lg font-medium">Google Calendar Integration</h3>
          <p className="text-sm text-muted-foreground">
            Connect your Google Calendar to view all your events alongside GTD items.
          </p>
        </div>

        {/* OAuth Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              OAuth Configuration
            </CardTitle>
            <CardDescription>
              Configure your Google OAuth credentials for secure authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasConfig ? (
              <>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    To connect your Google Calendar, you need to provide OAuth credentials from your Google Cloud Console.
                  </p>
                  
                  <div className="space-y-2">
                    <Label htmlFor="client_id">Client ID</Label>
                    <Input
                      id="client_id"
                      type="text"
                      placeholder="123456789012-abcdefghijk.apps.googleusercontent.com"
                      value={formData.client_id}
                      onChange={(e) => setFormData(prev => ({...prev, client_id: e.target.value}))}
                      disabled={isConfiguring}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="client_secret">Client Secret</Label>
                    <div className="relative">
                      <Input
                        id="client_secret"
                        type={showClientSecret ? "text" : "password"}
                        placeholder="Enter your OAuth client secret"
                        value={formData.client_secret}
                        onChange={(e) => setFormData(prev => ({...prev, client_secret: e.target.value}))}
                        disabled={isConfiguring}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowClientSecret(!showClientSecret)}
                        disabled={isConfiguring}
                      >
                        {showClientSecret ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveConfig}
                    disabled={isConfiguring || !isFormValid()}
                    className="w-full"
                  >
                    {isConfiguring ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </div>

                <div className="pt-4 border-t">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">How to get OAuth credentials:</h4>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Cloud Console</a></li>
                      <li>Create or select a project</li>
                      <li>Enable the Google Calendar API</li>
                      <li>Go to "Credentials" → "Create Credentials" → "OAuth client ID"</li>
                      <li>Choose "Desktop app" as the application type (this automatically allows localhost redirects)</li>
                      <li>Note: Desktop apps don't require adding redirect URIs - the app uses <code className="bg-muted px-1 rounded">http://localhost:9898/callback</code></li>
                      <li>Copy the Client ID and Client Secret to the form above</li>
                    </ol>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">OAuth Configuration Active</p>
                    <p className="text-xs text-muted-foreground">
                      Client ID: {oauthConfig?.client_id ? truncateString(oauthConfig.client_id, 20) : 'Configured'}
                    </p>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    Configured
                  </Badge>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearConfig}
                  disabled={isConfiguring}
                >
                  {isConfiguring ? 'Clearing...' : 'Clear Configuration'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Connection Status
            </CardTitle>
            <CardDescription>
              Manage your Google Calendar connection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Label>Status:</Label>
                {syncStatus?.isConnected ? (
                  <Badge variant="default" className="bg-green-600">
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    Not Connected
                  </Badge>
                )}
              </div>

              {syncStatus?.isConnected ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isSyncing}
                >
                  <Link2Off className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleConnect}
                  disabled={isConnecting || !hasConfig}
                  title={!hasConfig ? 'Configure OAuth credentials first' : ''}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </Button>
              )}
            </div>

            {!hasConfig && !syncStatus?.isConnected && (
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Configure your OAuth credentials above before connecting to Google Calendar.
                </p>
              </div>
            )}

            {syncStatus?.isConnected && (
              <>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Last synced: {formatLastSync(syncStatus.lastSync)}
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSync}
                    disabled={isSyncing || syncStatus.syncInProgress}
                  >
                    <RefreshCw className={cn(
                      "h-4 w-4 mr-2",
                      (isSyncing || syncStatus.syncInProgress) && "animate-spin"
                    )} />
                    {isSyncing || syncStatus.syncInProgress ? 'Syncing...' : 'Sync Now'}
                  </Button>
                </div>

                {syncStatus.error && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-md">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <p className="text-sm text-destructive">{syncStatus.error}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Sync Settings Card */}
        {syncStatus?.isConnected && (
          <Card>
            <CardHeader>
              <CardTitle>Sync Settings</CardTitle>
              <CardDescription>
                Configure how Google Calendar syncs with GTD Space
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-sync">Auto-sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync calendar every 15 minutes
                  </p>
                </div>
                <Switch
                  id="auto-sync"
                  checked={autoSync}
                  onCheckedChange={setAutoSync}
                />
              </div>

              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  Events are synced from 30 days ago to 90 days in the future.
                  All calendars from your Google account are included.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>About Google Calendar Integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              When connected, your Google Calendar events will appear in the GTD Space calendar view with a purple color.
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Click on Google events to open meeting links</li>
              <li>View event locations and attendees</li>
              <li>Events are cached locally for offline access</li>
              <li>Your calendar data is never shared or uploaded</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};