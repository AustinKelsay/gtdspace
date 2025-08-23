/**
 * @fileoverview About section component displaying app information
 * @author Development Team
 * @created 2025-01-XX
 */

import React from 'react';
import { 
  Target,
  Github,
  FileText,
  Heart,
  ExternalLink,
  Package,
  Code2,
  Sparkles,
  BookOpen,
  MessageCircle,
  Shield
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getVersion, getTauriVersion } from '@tauri-apps/api/app';

/**
 * About section component displaying app information and resources
 */
export const AboutSection: React.FC = () => {
  const [appVersion, setAppVersion] = React.useState<string>('Loading...');
  const [tauriVersion, setTauriVersion] = React.useState<string>('Loading...');
  const [systemInfo, setSystemInfo] = React.useState<{
    os: string;
    arch: string;
    version: string;
  } | null>(null);

  React.useEffect(() => {
    // Get app version from Tauri API
    getVersion()
      .then(version => setAppVersion(version))
      .catch(() => setAppVersion('1.0.0'));

    // Get Tauri version
    getTauriVersion()
      .then(version => setTauriVersion(version))
      .catch(() => setTauriVersion('2.x'));

    // Get system information
    const platform = navigator.platform;
    const userAgent = navigator.userAgent;
    
    let os = 'Unknown';
    if (platform.includes('Win')) os = 'Windows';
    else if (platform.includes('Mac')) os = 'macOS';
    else if (platform.includes('Linux')) os = 'Linux';
    
    setSystemInfo({
      os,
      arch: platform,
      version: userAgent,
    });
  }, []);

  const openExternalLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="relative">
            <Target className="h-16 w-16 text-primary" />
            <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-1 -right-1" />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2">GTD Space</h1>
        <p className="text-lg text-muted-foreground mb-2">
          Your personal productivity system
        </p>
        <Badge variant="default" className="text-sm">
          Version {appVersion}
        </Badge>
      </div>

      {/* Description */}
      <Card className="p-6">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            GTD Space is a comprehensive productivity application built on the Getting Things Done® methodology 
            by David Allen. It provides a complete system for capturing, organizing, and managing your 
            commitments across all horizons of focus.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">GTD®</Badge>
            <Badge variant="outline">Markdown</Badge>
            <Badge variant="outline">React</Badge>
            <Badge variant="outline">TypeScript</Badge>
            <Badge variant="outline">Tauri</Badge>
            <Badge variant="outline">Rust</Badge>
          </div>
        </div>
      </Card>

      {/* Resources */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <Label className="text-base font-semibold">Resources</Label>
        </div>
        
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => openExternalLink('https://github.com/yourusername/gtdspace')}
          >
            <Github className="h-4 w-4 mr-2" />
            GitHub Repository
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => openExternalLink('https://gtdspace.com/docs')}
          >
            <FileText className="h-4 w-4 mr-2" />
            Documentation
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => openExternalLink('https://gettingthingsdone.com')}
          >
            <Target className="h-4 w-4 mr-2" />
            GTD® Official Website
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
        </div>
      </Card>

      {/* Support */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="h-5 w-5 text-muted-foreground" />
          <Label className="text-base font-semibold">Support</Label>
        </div>
        
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => openExternalLink('https://github.com/yourusername/gtdspace/issues')}
          >
            <Github className="h-4 w-4 mr-2" />
            Report an Issue
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => openExternalLink('https://gtdspace.com/community')}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Community Forum
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
          
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => openExternalLink('mailto:support@gtdspace.com')}
          >
            <Heart className="h-4 w-4 mr-2" />
            Contact Support
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
        </div>
      </Card>

      {/* System Information */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-muted-foreground" />
          <Label className="text-base font-semibold">System Information</Label>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Application Version</span>
            <span className="text-sm font-mono">{appVersion}</span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Operating System</span>
            <span className="text-sm font-mono">{systemInfo?.os || 'Unknown'}</span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Platform</span>
            <span className="text-sm font-mono">{systemInfo?.arch || 'Unknown'}</span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Tauri Version</span>
            <span className="text-sm font-mono">{tauriVersion}</span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">React Version</span>
            <span className="text-sm font-mono">18.x</span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">BlockNote Version</span>
            <span className="text-sm font-mono">0.35</span>
          </div>
        </div>
      </Card>

      {/* Credits */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="h-5 w-5 text-muted-foreground" />
          <Label className="text-base font-semibold">Credits</Label>
        </div>
        
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            GTD Space is built with love by the development team and contributors.
          </p>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Lead Developer: Your Name</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">GTD® Methodology: David Allen Company</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">License: MIT</span>
            </div>
          </div>
          
          <Separator />
          
          <p className="text-xs text-muted-foreground italic">
            Getting Things Done® and GTD® are registered trademarks of the David Allen Company. 
            GTD Space is not affiliated with or endorsed by the David Allen Company.
          </p>
        </div>
      </Card>

      {/* Footer */}
      <div className="text-center pt-4">
        <p className="text-sm text-muted-foreground">
          Made with ❤️ for productivity enthusiasts
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          © 2025 GTD Space. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default AboutSection;