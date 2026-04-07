'use client';

type LoaderProps = {
  className?: string;
  /** Pixel size (defaults to 50). */
  size?: number;
};

export function Loader({ className = '', size = 50 }: LoaderProps) {
  return (
    <div
      className={`vybe-loader ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
      role="status"
    />
  );
}

