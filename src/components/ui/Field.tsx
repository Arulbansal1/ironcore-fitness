'use client';

import { AlertCircle } from 'lucide-react';
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/lib/utils';

const CONTROL_BASE =
  'w-full rounded-lg border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-muted/70 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70';

function controlClasses(hasError?: boolean) {
  return cn(
    CONTROL_BASE,
    hasError
      ? 'border-red-400 focus-visible:ring-red-400/70'
      : 'border-line hover:border-muted/50',
  );
}

type FieldShellProps = {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
};

export function FieldShell({ label, hint, error, required, htmlFor, children, className }: FieldShellProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

// --- Input -----------------------------------------------------------------

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, trailing, className, containerClassName, id, required, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      className={containerClassName}
    >
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            {leading}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          className={cn(
            controlClasses(Boolean(error)),
            'h-10',
            leading && 'pl-9',
            trailing && 'pr-10',
            className,
          )}
          {...props}
        />
        {trailing && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted">{trailing}</span>
        )}
      </div>
    </FieldShell>
  );
});

// --- Textarea --------------------------------------------------------------

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, containerClassName, id, required, ...props },
  ref,
) {
  const generated = useId();
  const textareaId = id ?? generated;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={textareaId}
      className={containerClassName}
    >
      <textarea
        ref={ref}
        id={textareaId}
        required={required}
        aria-invalid={Boolean(error)}
        className={cn(controlClasses(Boolean(error)), 'min-h-[110px] resize-y py-2.5 leading-relaxed', className)}
        {...props}
      />
    </FieldShell>
  );
});

// --- Select ----------------------------------------------------------------

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, containerClassName, id, required, options, placeholder, ...props },
  ref,
) {
  const generated = useId();
  const selectId = id ?? generated;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={selectId}
      className={containerClassName}
    >
      <select
        ref={ref}
        id={selectId}
        required={required}
        aria-invalid={Boolean(error)}
        className={cn(controlClasses(Boolean(error)), 'h-10 cursor-pointer pr-8', className)}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});

// --- Checkbox --------------------------------------------------------------

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, className, id, ...props },
  ref,
) {
  const generated = useId();
  const checkboxId = id ?? generated;

  return (
    <div className="flex items-start gap-2.5">
      <input
        ref={ref}
        id={checkboxId}
        type="checkbox"
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line text-brand-600 accent-brand-600',
          className,
        )}
        {...props}
      />
      <label htmlFor={checkboxId} className="cursor-pointer select-none text-sm text-ink">
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </label>
    </div>
  );
});
