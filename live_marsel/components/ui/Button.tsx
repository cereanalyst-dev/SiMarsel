import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'yellow' | 'pink' | 'cyan' | 'lime' | 'black' | 'white';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
}

const VARIANT: Record<Variant, string> = {
  yellow: 'bg-nb-yellow text-nb-black hover:bg-yellow-300',
  pink:   'bg-nb-pink text-nb-black hover:bg-pink-400',
  cyan:   'bg-nb-cyan text-nb-black hover:bg-cyan-300',
  lime:   'bg-nb-lime text-nb-black hover:bg-lime-300',
  black:  'bg-nb-black text-white hover:bg-zinc-800',
  white:  'bg-white text-nb-black hover:bg-zinc-100',
};

const SIZE = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'yellow', size = 'md', children, ...props }, ref) => (
    <button
      ref={ref}
      className={
        `${VARIANT[variant]} ${SIZE[size]} font-display uppercase tracking-tight ` +
        `border-[3px] border-nb-black shadow-nb-sm ` +
        `transition-all duration-100 ` +
        `hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-nb ` +
        `active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ` +
        `disabled:opacity-50 disabled:cursor-not-allowed ` +
        `${className}`
      }
      {...props}
    >
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
