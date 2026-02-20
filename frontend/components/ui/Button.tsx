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
  primary: 'bg-primary text-white shadow-soft hover:bg-primary-dark',
  secondary: 'bg-primary-dark text-white hover:opacity-90',
  accent: 'bg-accent text-white hover:bg-accent-hover',
  outline: 'border-2 border-primary text-primary bg-transparent hover:bg-primary hover:text-white',
  ghost: 'text-primary hover:bg-primary/10',
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
