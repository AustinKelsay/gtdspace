import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Users, Link2, FileText, ExternalLink, FolderOpen } from 'lucide-react';
import { format } from 'date-fns';
import { ExtendedCalendarItem } from '@/types/google-calendar';

interface EventDetailModalProps {
  event: ExtendedCalendarItem | null;
  isOpen: boolean;
  onClose: () => void;
  onFileOpen?: (path: string) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  isOpen,
  onClose,
  onFileOpen,
}) => {
  if (!event) return null;

  const formatEventTime = (date: string | undefined, time: string | undefined) => {
    if (!date && !time) return 'No time specified';

    if (time) {
      // Parse the time and format it nicely
      try {
        const dateTime = new Date(`${date || '2024-01-01'}T${time}`);
        return format(dateTime, 'h:mm a');
      } catch {
        return time;
      }
    }

    if (date) {
      try {
        const dateObj = new Date(date);
        return format(dateObj, 'PPP');
      } catch {
        return date;
      }
    }

    return 'No time specified';
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'project':
        return 'bg-orange-500';
      case 'action':
        return 'bg-blue-500';
      case 'habit':
        return 'bg-green-500';
      case 'google-event':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'project':
        return 'Project';
      case 'action':
        return 'Action';
      case 'habit':
        return 'Habit';
      case 'google-event':
        return 'Google Calendar';
      default:
        return 'Event';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${getEventTypeColor(event.type)}`} />
            {event.name || 'Untitled Event'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Event Type Badge */}
          <div>
            <Badge variant="outline" className="mb-3">
              {getEventTypeLabel(event.type)}
            </Badge>
          </div>

          {/* Dates */}
          <div className="space-y-2">
            {(event.focusDate || event.dueDate) && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>
                  {event.focusDate ? formatEventTime(event.focusDate, undefined) : null}
                  {event.focusDate && event.dueDate ? ' - ' : null}
                  {event.dueDate ? formatEventTime(event.dueDate, undefined) : null}
                </span>
              </div>
            )}
          </div>

          {/* Project Name (for actions) */}
          {event.projectName && (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span>Project: {event.projectName}</span>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{event.location}</span>
            </div>
          )}

          {/* Meeting Link */}
          {event.meetingLink && (
            <div className="flex items-center gap-2 text-sm">
              <Link2 className="w-4 h-4 text-muted-foreground" />
              <a
                href={event.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Join Meeting
              </a>
            </div>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-start gap-2 text-sm">
              <Users className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium mb-1">Attendees:</div>
                <div className="space-y-1">
                  {event.attendees.map((attendee: string, index: number) => (
                    <div key={index} className="text-muted-foreground">
                      {attendee}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="text-sm">
              <div className="font-medium mb-1">Description:</div>
              <div className="text-muted-foreground whitespace-pre-wrap">
                {event.description}
              </div>
            </div>
          )}

          {/* Status */}
          {event.status && (
            <div className="text-sm">
              <span className="font-medium">Status: </span>
              <span className="text-muted-foreground capitalize">{event.status}</span>
            </div>
          )}

          {/* Effort removed - not part of ExtendedCalendarItem */}

          {/* Frequency (for habits) */}
          {event.frequency && (
            <div className="text-sm">
              <span className="font-medium">Frequency: </span>
              <span className="text-muted-foreground capitalize">{event.frequency}</span>
            </div>
          )}
        </div>

        {/* Dialog Footer with Actions */}
        <DialogFooter className="flex gap-2 sm:justify-between">
          <div className="flex gap-2">
            {/* Open File button for GTD items */}
            {event.type !== 'google-event' && event.path && onFileOpen && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onFileOpen(event.path);
                  onClose();
                }}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Open File
              </Button>
            )}

            {/* Join Meeting button for Google Calendar events with meeting links */}
            {event.type === 'google-event' && event.meetingLink && (
              <Button
                variant="default"
                size="sm"
                onClick={() => window.open(event.meetingLink, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Join Meeting
              </Button>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};