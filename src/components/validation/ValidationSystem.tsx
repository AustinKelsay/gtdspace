/**
 * @fileoverview Real-time input validation and feedback system
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Real-time validation with user feedback
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// === TYPES ===
export type ValidationLevel = 'error' | 'warning' | 'info' | 'success';

export interface ValidationRule {
  /** Unique identifier for the rule */
  id: string;
  /** Validation function that returns true if valid */
  validate: (value: any) => boolean;
  /** Error message to display when validation fails */
  message: string;
  /** Validation level (error, warning, info, success) */
  level: ValidationLevel;
  /** Whether validation should run in real-time */
  realTime?: boolean;
  /** Debounce delay in milliseconds for real-time validation */
  debounceMs?: number;
}

export interface ValidationResult {
  /** Whether the field is valid */
  isValid: boolean;
  /** Validation messages grouped by level */
  messages: Record<ValidationLevel, string[]>;
  /** Whether validation is currently running */
  isValidating: boolean;
}

export interface FieldValidation {
  /** Field identifier */
  fieldId: string;
  /** Current validation result */
  result: ValidationResult;
  /** Validation rules for this field */
  rules: ValidationRule[];
  /** Current field value */
  value: any;
}

interface ValidationContextValue {
  /** All field validations */
  fields: Map<string, FieldValidation>;
  /** Register a field for validation */
  registerField: (fieldId: string, rules: ValidationRule[], initialValue?: any) => void;
  /** Unregister a field */
  unregisterField: (fieldId: string) => void;
  /** Update field value and trigger validation */
  updateField: (fieldId: string, value: any) => void;
  /** Manually trigger validation for a field */
  validateField: (fieldId: string) => void;
  /** Validate all fields */
  validateAll: () => boolean;
  /** Get validation result for a field */
  getValidation: (fieldId: string) => ValidationResult | null;
}

// === VALIDATION RULES LIBRARY ===
export const ValidationRules = {
  // File name validation
  fileName: {
    required: (): ValidationRule => ({
      id: 'fileName-required',
      validate: (value: string) => !!value?.trim(),
      message: 'File name is required',
      level: 'error',
      realTime: true,
      debounceMs: 300,
    }),
    
    validCharacters: (): ValidationRule => ({
      id: 'fileName-chars',
      validate: (value: string) => /^[a-zA-Z0-9\s\-_.()]+$/.test(value),
      message: 'File name contains invalid characters',
      level: 'error',
      realTime: true,
      debounceMs: 300,
    }),
    
    length: (min = 1, max = 255): ValidationRule => ({
      id: 'fileName-length',
      validate: (value: string) => {
        const len = value?.trim().length || 0;
        return len >= min && len <= max;
      },
      message: `File name must be between ${min} and ${max} characters`,
      level: 'error',
      realTime: true,
      debounceMs: 300,
    }),
    
    markdownExtension: (): ValidationRule => ({
      id: 'fileName-md-extension',
      validate: (value: string) => {
        if (!value?.trim()) return true; // Let required rule handle this
        return value.endsWith('.md') || !value.includes('.');
      },
      message: 'File should have .md extension or no extension',
      level: 'warning',
      realTime: true,
      debounceMs: 500,
    }),
  },
  
  // Search query validation
  search: {
    minLength: (min = 2): ValidationRule => ({
      id: 'search-min-length',
      validate: (value: string) => !value || value.length >= min,
      message: `Search query must be at least ${min} characters`,
      level: 'info',
      realTime: true,
      debounceMs: 200,
    }),
    
    maxLength: (max = 100): ValidationRule => ({
      id: 'search-max-length',
      validate: (value: string) => !value || value.length <= max,
      message: `Search query cannot exceed ${max} characters`,
      level: 'warning',
      realTime: true,
      debounceMs: 300,
    }),
    
    validRegex: (): ValidationRule => ({
      id: 'search-regex',
      validate: (value: string) => {
        if (!value) return true;
        try {
          new RegExp(value);
          return true;
        } catch {
          return true; // Allow invalid regex, just warn
        }
      },
      message: 'Invalid regular expression pattern',
      level: 'warning',
      realTime: true,
      debounceMs: 500,
    }),
  },
  
  // Folder path validation
  folderPath: {
    required: (): ValidationRule => ({
      id: 'folderPath-required',
      validate: (value: string) => !!value?.trim(),
      message: 'Folder path is required',
      level: 'error',
      realTime: false,
    }),
    
    validPath: (): ValidationRule => ({
      id: 'folderPath-valid',
      validate: (value: string) => {
        if (!value) return true;
        // Basic path validation - more robust validation would be platform-specific
        return !value.includes('..') && !/[<>:"|?*]/.test(value);
      },
      message: 'Invalid folder path',
      level: 'error',
      realTime: true,
      debounceMs: 500,
    }),
    
    exists: (): ValidationRule => ({
      id: 'folderPath-exists',
      validate: (_value: string) => {
        // This would need async validation in real implementation
        // For now, always return true
        return true;
      },
      message: 'Folder does not exist',
      level: 'warning',
      realTime: false,
    }),
  },
};

// === CONTEXT ===
const ValidationContext = createContext<ValidationContextValue | undefined>(undefined);

// === VALIDATION PROVIDER ===
export const ValidationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fields, setFields] = useState<Map<string, FieldValidation>>(new Map());

  const registerField = useCallback((fieldId: string, rules: ValidationRule[], initialValue: any = '') => {
    setFields(prev => {
      const newFields = new Map(prev);
      newFields.set(fieldId, {
        fieldId,
        rules,
        value: initialValue,
        result: {
          isValid: true,
          messages: { error: [], warning: [], info: [], success: [] },
          isValidating: false,
        },
      });
      return newFields;
    });
  }, []);

  const unregisterField = useCallback((fieldId: string) => {
    setFields(prev => {
      const newFields = new Map(prev);
      newFields.delete(fieldId);
      return newFields;
    });
  }, []);

  const validateField = useCallback((fieldId: string) => {
    setFields(prev => {
      const newFields = new Map(prev);
      const field = newFields.get(fieldId);
      if (!field) return prev;

      // Start validation
      field.result.isValidating = true;
      newFields.set(fieldId, { ...field });

      // Run validation rules
      const messages: Record<ValidationLevel, string[]> = {
        error: [],
        warning: [],
        info: [],
        success: [],
      };

      let isValid = true;

      for (const rule of field.rules) {
        const ruleResult = rule.validate(field.value);
        if (!ruleResult) {
          messages[rule.level].push(rule.message);
          if (rule.level === 'error') {
            isValid = false;
          }
        }
      }

      // Update result
      field.result = {
        isValid,
        messages,
        isValidating: false,
      };

      newFields.set(fieldId, { ...field });
      return newFields;
    });
  }, []);

  const updateField = useCallback((fieldId: string, fieldValue: any) => {
    setFields(prev => {
      const newFields = new Map(prev);
      const field = newFields.get(fieldId);
      if (!field) return prev;

      field.value = fieldValue;
      newFields.set(fieldId, { ...field });

      // Trigger real-time validation for applicable rules
      const realTimeRules = field.rules.filter(rule => rule.realTime);
      if (realTimeRules.length > 0) {
        // Debounce validation
        const debounceMs = Math.max(...realTimeRules.map(rule => rule.debounceMs || 0));
        setTimeout(() => validateField(fieldId), debounceMs);
      }

      return newFields;
    });
  }, [validateField]);

  const validateAll = useCallback(() => {
    let allValid = true;
    
    fields.forEach((field, fieldId) => {
      validateField(fieldId);
      if (!field.result.isValid) {
        allValid = false;
      }
    });

    return allValid;
  }, [fields, validateField]);

  const getValidation = useCallback((fieldId: string): ValidationResult | null => {
    return fields.get(fieldId)?.result || null;
  }, [fields]);

  const contextValue: ValidationContextValue = {
    fields,
    registerField,
    unregisterField,
    updateField,
    validateField,
    validateAll,
    getValidation,
  };

  return (
    <ValidationContext.Provider value={contextValue}>
      {children}
    </ValidationContext.Provider>
  );
};

// === HOOKS ===
export const useValidation = (): ValidationContextValue => {
  const context = useContext(ValidationContext);
  if (!context) {
    throw new Error('useValidation must be used within ValidationProvider');
  }
  return context;
};

export const useFieldValidation = (
  fieldId: string,
  rules: ValidationRule[],
  initialValue: any = ''
) => {
  const { registerField, unregisterField, updateField, getValidation } = useValidation();

  useEffect(() => {
    registerField(fieldId, rules, initialValue);
    return () => unregisterField(fieldId);
  }, [fieldId, rules, initialValue, registerField, unregisterField]);

  const setValue = useCallback((newValue: any) => {
    updateField(fieldId, newValue);
  }, [fieldId, updateField]);

  const validation = getValidation(fieldId);

  return {
    setValue,
    validation: validation || {
      isValid: true,
      messages: { error: [], warning: [], info: [], success: [] },
      isValidating: false,
    },
  };
};

// === VALIDATION MESSAGE COMPONENT ===
export interface ValidationMessageProps {
  validation: ValidationResult;
  showSuccess?: boolean;
  className?: string;
}

export const ValidationMessage: React.FC<ValidationMessageProps> = ({
  validation,
  showSuccess = false,
  className = '',
}) => {
  const { messages } = validation;
  
  // Determine which messages to show (prioritize errors, then warnings, etc.)
  let messagesToShow: { level: ValidationLevel; text: string }[] = [];
  
  if (messages.error.length > 0) {
    messagesToShow = messages.error.map(text => ({ level: 'error', text }));
  } else if (messages.warning.length > 0) {
    messagesToShow = messages.warning.map(text => ({ level: 'warning', text }));
  } else if (messages.info.length > 0) {
    messagesToShow = messages.info.map(text => ({ level: 'info', text }));
  } else if (showSuccess && messages.success.length > 0) {
    messagesToShow = messages.success.map(text => ({ level: 'success', text }));
  }

  if (messagesToShow.length === 0) {
    return null;
  }

  const getIcon = (level: ValidationLevel) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  const getTextColor = (level: ValidationLevel) => {
    switch (level) {
      case 'error':
        return 'text-destructive';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'info':
        return 'text-blue-600 dark:text-blue-400';
      case 'success':
        return 'text-green-600 dark:text-green-400';
    }
  };

  return (
    <div className={cn('space-y-1', className)}>
      {messagesToShow.map((msg, index) => (
        <div
          key={`${msg.level}-${index}`}
          className={cn(
            'flex items-center space-x-2 text-sm',
            getTextColor(msg.level)
          )}
        >
          {getIcon(msg.level)}
          <span>{msg.text}</span>
        </div>
      ))}
    </div>
  );
};

// === VALIDATED INPUT COMPONENT ===
export interface ValidatedInputProps {
  fieldId: string;
  rules: ValidationRule[];
  initialValue?: string;
  placeholder?: string;
  className?: string;
  showValidation?: boolean;
  type?: 'text' | 'search' | 'url' | 'email';
  onValueChange?: (value: string) => void;
}

export const ValidatedInput: React.FC<ValidatedInputProps> = ({
  fieldId,
  rules,
  initialValue = '',
  placeholder = '',
  className = '',
  showValidation = true,
  type = 'text',
  onValueChange,
}) => {
  const { setValue, validation } = useFieldValidation(fieldId, rules, initialValue);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setValue(value);
    onValueChange?.(value);
  };

  const hasError = !validation.isValid;
  const hasWarning = validation.messages.warning.length > 0;

  return (
    <div className="space-y-2">
      <input
        type={type}
        placeholder={placeholder}
        defaultValue={initialValue}
        onChange={handleChange}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          hasError && 'border-destructive focus-visible:ring-destructive',
          hasWarning && !hasError && 'border-yellow-500 focus-visible:ring-yellow-500',
          validation.isValid && validation.messages.success.length > 0 && 'border-green-500 focus-visible:ring-green-500',
          className
        )}
      />
      {showValidation && <ValidationMessage validation={validation} />}
    </div>
  );
};

export default ValidationProvider;