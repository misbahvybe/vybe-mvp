import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  // Brand rule: all buttons should be red-filled across the app.
  primary: 'bg-primary text-white shadow-soft hover:bg-accent-hover',
  secondary: 'bg-primary text-white shadow-soft hover:bg-accent-hover',
  accent: 'bg-primary text-white shadow-soft hover:bg-accent-hover',
  outline: 'bg-primary text-white shadow-soft hover:bg-accent-hover',
  ghost: 'bg-primary text-white shadow-soft hover:bg-accent-hover',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-button',
  md: 'px-5 py-2.5 text-base rounded-button',
  lg: 'px-6 py-3 text-lg rounded-button font-semibold',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth,
      loading,
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center transition-all duration-200 active:scale-[0.98]',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        disabled && 'opacity-60 cursor-not-allowed',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading ? (
        <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  )
);
Button.displayName = 'Button';
