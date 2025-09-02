/**
 * @fileoverview Google Calendar integration settings component
 * @author Development Team
 * @created 2025-01-23
 */

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, RefreshCw, Link2, Link2Off, Clock, AlertCircle } from 'lucide-react';
import type { SyncStatus } from '@/types/google-calendar';
import { cn } from '@/lib/utils';

export const GoogleCalendarSettings: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const { toast } = useToast();

  // Load status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const isAuthenticated = await invoke<boolean>('google_calendar_is_authenticated');
      console.log('[GoogleCalendarSettings] Authentication status:', isAuthenticated);

      if (isAuthenticated) {
        // Load last sync time from localStorage
        const lastSync = localStorage.getItem('google-calendar-last-sync');

        setSyncStatus({
          isConnected: true,
          lastSync: lastSync,
          syncInProgress: false,
          error: null
        });
      }
    } catch (error) {
      console.error('[GoogleCalendarSettings] Failed to check auth status:', error);
    }
  };


  const handleConnect = async () => {
    console.log('[GoogleCalendarSettings] Starting connection process...');

    setIsConnecting(true);
    try {
      console.log('[GoogleCalendarSettings] Invoking google_calendar_start_auth command...');
      const result = await invoke<string>('google_calendar_start_auth');
      console.log('[GoogleCalendarSettings] Auth started:', result);

      // Mark as connected in the UI
      setSyncStatus({
        isConnected: true,
        lastSync: null,
        syncInProgress: false,
        error: null
      });

      toast({
        title: 'Google Calendar Connected',
        description: result,
      });

      // Reload auth status after successful connection
      await checkAuthStatus();
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
      await invoke('google_calendar_disconnect_simple');

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
      const events = await invoke('google_calendar_fetch_events');
      console.log('[GoogleCalendarSettings] Fetched events:', events);

      // Store events in localStorage for now (until we have proper state management)
      if (Array.isArray(events)) {
        localStorage.setItem('google-calendar-events', JSON.stringify(events));

        // Store last sync time
        const now = new Date().toISOString();
        localStorage.setItem('google-calendar-last-sync', now);

        // Update UI
        setSyncStatus(prev => ({
          ...prev,
          lastSync: now
        }));

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
                  disabled={isConnecting}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </Button>
              )}
            </div>

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