/**
 * @fileoverview Embed system for external content (YouTube, GitHub Gists, etc.)
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
import React, { useState, useCallback, useEffect } from 'react';
import {
  Youtube,
  Github,
  Code,
  Figma,
  Twitter,
  ExternalLink,
  Loader2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import type { EmbedItem, EmbedType } from './types';

// === TYPES ===
/**
 * Props for the EmbedHandler component
 */
export interface EmbedHandlerProps {
  /** Whether the embed dialog is open */
  isOpen: boolean;
  /** Callback to close the embed dialog */
  onClose: () => void;
  /** Callback when embed is created */
  onEmbed: (embed: EmbedItem) => void;
  /** Initial URL to process */
  initialUrl?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Embed provider configuration
 */
interface EmbedProvider {
  type: EmbedType;
  name: string;
  icon: React.ReactNode;
  urlPattern: RegExp;
  extractId: (url: string) => string | null;
  generateEmbedCode: (id: string, options?: any) => string;
  fetchMetadata?: (url: string) => Promise<Partial<EmbedItem>>;
}

// === CONSTANTS ===
const EMBED_PROVIDERS: EmbedProvider[] = [
  // YouTube
  {
    type: 'youtube',
    name: 'YouTube',
    icon: <Youtube className="w-4 h-4" />,
    urlPattern: /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    extractId: (url) => {
      const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      return match ? match[1] : null;
    },
    generateEmbedCode: (id, options = {}) => {
      const { autoplay = false, controls = true, start = 0 } = options;
      return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${id}?autoplay=${autoplay ? 1 : 0}&controls=${controls ? 1 : 0}&start=${start}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    },
    fetchMetadata: async (url) => {
      // In a real implementation, you'd use YouTube API
      const id = EMBED_PROVIDERS[0].extractId(url);
      if (!id) return {};

      return {
        title: `YouTube Video - ${id}`,
        thumbnail: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
        description: 'YouTube video embed'
      };
    }
  },

  // GitHub Gists
  {
    type: 'github',
    name: 'GitHub Gist',
    icon: <Github className="w-4 h-4" />,
    urlPattern: /gist\.github\.com\/(?:.*\/)?([a-f0-9]+)/,
    extractId: (url) => {
      const match = url.match(/gist\.github\.com\/(?:.*\/)?([a-f0-9]+)/);
      return match ? match[1] : null;
    },
    generateEmbedCode: (id) => {
      return `<script src="https://gist.github.com/${id}.js"></script>`;
    },
    fetchMetadata: async (url) => {
      const id = EMBED_PROVIDERS[1].extractId(url);
      if (!id) return {};

      return {
        title: `GitHub Gist - ${id}`,
        description: 'GitHub Gist embed'
      };
    }
  },

  // CodePen
  {
    type: 'codepen',
    name: 'CodePen',
    icon: <Code className="w-4 h-4" />,
    urlPattern: /codepen\.io\/([^\/]+)\/pen\/([^\/?\s]+)/,
    extractId: (url) => {
      const match = url.match(/codepen\.io\/([^\/]+)\/pen\/([^\/?\s]+)/);
      return match ? `${match[1]}/${match[2]}` : null;
    },
    generateEmbedCode: (id, options = {}) => {
      const [user, pen] = id.split('/');
      const { height = 300, theme = 'default' } = options;
      return `<iframe height="${height}" style="width: 100%;" scrolling="no" title="CodePen Embed" src="https://codepen.io/${user}/embed/${pen}?height=${height}&theme-id=${theme}&default-tab=html,result" frameborder="no" loading="lazy" allowtransparency="true" allowfullscreen="true"></iframe>`;
    },
    fetchMetadata: async (url) => {
      const id = EMBED_PROVIDERS[2].extractId(url);
      if (!id) return {};

      return {
        title: `CodePen - ${id}`,
        description: 'CodePen embed'
      };
    }
  },

  // Figma
  {
    type: 'figma',
    name: 'Figma',
    icon: <Figma className="w-4 h-4" />,
    urlPattern: /figma\.com\/file\/([a-zA-Z0-9]+)/,
    extractId: (url) => {
      const match = url.match(/figma\.com\/file\/([a-zA-Z0-9]+)/);
      return match ? match[1] : null;
    },
    generateEmbedCode: (id) => {
      return `<iframe style="border: 1px solid rgba(0, 0, 0, 0.1);" width="800" height="450" src="https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/file/${id}" allowfullscreen></iframe>`;
    }
  },

  // Twitter
  {
    type: 'twitter',
    name: 'Twitter/X',
    icon: <Twitter className="w-4 h-4" />,
    urlPattern: /(?:twitter\.com|x\.com)\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/,
    extractId: (url) => {
      const match = url.match(/(?:twitter\.com|x\.com)\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/);
      return match ? `${match[1]}/${match[2]}` : null;
    },
    generateEmbedCode: (id) => {
      const [username, tweetId] = id.split('/');
      return `<blockquote class="twitter-tweet"><a href="https://twitter.com/${username}/status/${tweetId}"></a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`;
    }
  }
];

// === MAIN COMPONENT ===
/**
 * Embed system for external content (YouTube, GitHub Gists, etc.)
 * 
 * Provides functionality for embedding external content from various
 * platforms including YouTube, GitHub Gists, CodePen, Figma, and Twitter.
 * Features automatic URL detection, metadata fetching, and embed generation.
 * 
 * @param props - Component props
 * @returns JSX element containing the embed handler dialog
 */
export const EmbedHandler: React.FC<EmbedHandlerProps> = ({
  isOpen,
  onClose,
  onEmbed,
  initialUrl = '',
  className
}) => {
  // === STATE ===
  const [url, setUrl] = useState(initialUrl);
  const [selectedProvider, setSelectedProvider] = useState<EmbedProvider | null>(null);
  const [embedOptions, setEmbedOptions] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<EmbedItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // === EFFECTS ===

  /**
   * Auto-detect provider when URL changes
   */
  useEffect(() => {
    if (url.trim()) {
      const provider = EMBED_PROVIDERS.find(p => p.urlPattern.test(url));
      setSelectedProvider(provider || null);
      setError(null);

      if (provider) {
        generatePreview(url, provider);
      }
    } else {
      setSelectedProvider(null);
      setPreview(null);
      setError(null);
    }
  }, [url]);

  /**
   * Reset state when dialog opens/closes
   */
  useEffect(() => {
    if (!isOpen) {
      setUrl(initialUrl);
      setSelectedProvider(null);
      setEmbedOptions({});
      setPreview(null);
      setError(null);
      setCopied(false);
    }
  }, [isOpen, initialUrl]);

  // === HANDLERS ===

  /**
   * Generates embed preview
   */
  const generatePreview = useCallback(async (url: string, provider: EmbedProvider) => {
    setIsLoading(true);
    setError(null);

    try {
      const id = provider.extractId(url);
      if (!id) {
        throw new Error('Could not extract ID from URL');
      }

      // Fetch metadata if provider supports it
      let metadata: Partial<EmbedItem> = {};
      if (provider.fetchMetadata) {
        try {
          metadata = await provider.fetchMetadata(url);
        } catch (e) {
          console.warn('Failed to fetch metadata:', e);
        }
      }

      // Generate embed code
      const embedCode = provider.generateEmbedCode(id, embedOptions);

      const embedItem: EmbedItem = {
        id: `embed-${Date.now()}`,
        type: provider.type,
        url,
        title: metadata.title || `${provider.name} Embed`,
        description: metadata.description || `Embedded content from ${provider.name}`,
        thumbnail: metadata.thumbnail,
        embedCode,
        dimensions: {
          width: 800,
          height: 450
        },
        metadata: {
          providerId: id,
          provider: provider.name,
          ...metadata.metadata
        }
      };

      setPreview(embedItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setIsLoading(false);
    }
  }, [embedOptions]);

  /**
   * Handles embed creation
   */
  const handleCreateEmbed = useCallback(() => {
    if (preview) {
      onEmbed(preview);
      onClose();
    }
  }, [preview, onEmbed, onClose]);

  /**
   * Handles copying embed code
   */
  const handleCopyEmbedCode = useCallback(async () => {
    if (preview?.embedCode) {
      try {
        await navigator.clipboard.writeText(preview.embedCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  }, [preview]);

  /**
   * Handles manual provider selection
   */
  const handleProviderSelect = useCallback((providerType: string) => {
    const provider = EMBED_PROVIDERS.find(p => p.type === providerType);
    setSelectedProvider(provider || null);

    if (provider && url.trim()) {
      generatePreview(url, provider);
    }
  }, [url, generatePreview]);

  // === RENDER HELPERS ===

  /**
   * Renders provider options
   */
  const renderProviderOptions = () => {
    if (!selectedProvider || selectedProvider.type !== 'youtube') return null;

    return (
      <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
        <Label className="text-sm font-medium">YouTube Options</Label>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoplay"
              checked={embedOptions.autoplay || false}
              onChange={(e) => setEmbedOptions(prev => ({ ...prev, autoplay: e.target.checked }))}
            />
            <Label htmlFor="autoplay" className="text-sm">Auto-play</Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="controls"
              checked={embedOptions.controls !== false}
              onChange={(e) => setEmbedOptions(prev => ({ ...prev, controls: e.target.checked }))}
            />
            <Label htmlFor="controls" className="text-sm">Show controls</Label>
          </div>
        </div>

        <div>
          <Label htmlFor="start-time" className="text-sm">Start time (seconds)</Label>
          <Input
            id="start-time"
            type="number"
            min="0"
            value={embedOptions.start || 0}
            onChange={(e) => setEmbedOptions(prev => ({ ...prev, start: parseInt(e.target.value) || 0 }))}
            className="mt-1"
          />
        </div>
      </div>
    );
  };

  /**
   * Renders embed preview
   */
  const renderPreview = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8 border border-border rounded-lg">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Loading preview...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center p-8 border border-border rounded-lg border-red-200 bg-red-50 dark:bg-red-900/10">
          <AlertCircle className="w-6 h-6 text-red-600 mr-2" />
          <span className="text-red-600">{error}</span>
        </div>
      );
    }

    if (!preview) return null;

    return (
      <Card className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-medium">{preview.title}</h3>
            {preview.description && (
              <p className="text-sm text-muted-foreground mt-1">{preview.description}</p>
            )}
          </div>

          {preview.thumbnail && (
            <div className="w-20 h-12 bg-muted rounded overflow-hidden ml-4">
              <img
                src={preview.thumbnail}
                alt="Thumbnail"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Preview iframe */}
        <div className="aspect-video bg-muted rounded-lg overflow-hidden">
          <div
            dangerouslySetInnerHTML={{ __html: preview.embedCode || '' }}
            className="w-full h-full"
          />
        </div>

        {/* Embed code */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Embed Code</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyEmbedCode}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <div className="bg-muted p-3 rounded-lg text-xs font-mono overflow-auto max-h-24">
            {preview.embedCode}
          </div>
        </div>
      </Card>
    );
  };

  // === MAIN RENDER ===
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn('max-w-4xl max-h-[90vh] overflow-y-auto', className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5" />
            Embed External Content
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="embed-url">URL</Label>
            <div className="flex gap-2">
              <Input
                id="embed-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube, GitHub Gist, CodePen, Figma, or Twitter URL..."
                className="flex-1"
              />
              {selectedProvider && (
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                  {selectedProvider.icon}
                  <span className="text-sm">{selectedProvider.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Manual Provider Selection */}
          {!selectedProvider && url.trim() && (
            <div className="space-y-2">
              <Label>Or select provider manually:</Label>
              <Select onValueChange={handleProviderSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {EMBED_PROVIDERS.map(provider => (
                    <SelectItem key={provider.type} value={provider.type}>
                      <div className="flex items-center gap-2">
                        {provider.icon}
                        {provider.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Provider Options */}
          {renderProviderOptions()}

          {/* Preview */}
          {renderPreview()}

          {/* Supported Platforms */}
          {!url.trim() && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Supported Platforms</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {EMBED_PROVIDERS.map(provider => (
                  <div
                    key={provider.type}
                    className="flex items-center gap-2 p-3 border border-border rounded-lg"
                  >
                    {provider.icon}
                    <span className="text-sm">{provider.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>

            <Button
              onClick={handleCreateEmbed}
              disabled={!preview || isLoading}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Insert Embed
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmbedHandler;