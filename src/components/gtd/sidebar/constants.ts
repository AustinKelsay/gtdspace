import {
  Archive,
  Briefcase,
  Calendar,
  Lightbulb,
  RefreshCw,
  Target,
} from 'lucide-react';
import type { HorizonType } from '@/utils/horizon-config';
import { CALENDAR_FILE_ID } from '@/utils/special-files';
import type { GTDSection } from './types';

export const SIDEBAR_ACTIVE_ROW_CLASSES = 'bg-primary/10 ring-1 ring-primary/20';

export const GTD_SECTIONS: GTDSection[] = [
  {
    id: 'purpose',
    name: 'Purpose & Principles',
    icon: Target,
    path: 'Purpose & Principles',
    description: 'Core values and life mission (50,000 ft)',
    color: 'text-purple-600',
  },
  {
    id: 'vision',
    name: 'Vision',
    icon: Target,
    path: 'Vision',
    description: '3-5 year aspirations (40,000 ft)',
    color: 'text-indigo-600',
  },
  {
    id: 'goals',
    name: 'Goals',
    icon: Target,
    path: 'Goals',
    description: '1-2 year objectives (30,000 ft)',
    color: 'text-violet-600',
  },
  {
    id: 'areas',
    name: 'Areas of Focus',
    icon: Target,
    path: 'Areas of Focus',
    description: 'Ongoing responsibilities (20,000 ft)',
    color: 'text-blue-700',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: Calendar,
    path: CALENDAR_FILE_ID,
    description: 'View all dated items',
    color: 'text-orange-600',
  },
  {
    id: 'projects',
    name: 'Projects',
    icon: Briefcase,
    path: 'Projects',
    description: 'Active projects and their actions',
    color: 'text-blue-600',
  },
  {
    id: 'habits',
    name: 'Habits',
    icon: RefreshCw,
    path: 'Habits',
    description: 'Daily and weekly routines',
    color: 'text-green-600',
  },
  {
    id: 'someday',
    name: 'Someday Maybe',
    icon: Lightbulb,
    path: 'Someday Maybe',
    description: 'Ideas for future consideration',
    color: 'text-purple-600',
  },
  {
    id: 'cabinet',
    name: 'Cabinet',
    icon: Archive,
    path: 'Cabinet',
    description: 'Reference materials',
    color: 'text-gray-600',
  },
];

export const HORIZON_FOLDER_TO_TYPE: Record<string, HorizonType> = {
  'Purpose & Principles': 'purpose',
  Vision: 'vision',
  Goals: 'goals',
  'Areas of Focus': 'areas',
};
