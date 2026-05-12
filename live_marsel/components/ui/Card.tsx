import { type HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'paper' | 'yellow' | 'pink' | 'cyan' | 'lime' | 'purple' | 'orange';
  noShadow?: boolean;
}

const VARIANT_BG: Record<NonNullable<CardProps['variant']>, string> = {
  paper:  'bg-nb-paper',
  yellow: 'bg-nb-yellow',
  pink:   'bg-nb-pink',
  cyan:   'bg-nb-cyan',
  lime:   'bg-nb-lime',
  purple: 'bg-nb-purple',
  orange: 'bg-nb-orange',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'paper', noShadow = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={
        `${VARIANT_BG[variant]} border-[3px] border-nb-black ` +
        `${noShadow ? '' : 'shadow-nb-sm'} p-4 md:p-5 ${className}`
      }
      {...props}
    >
      {children}
    </div>
  ),
);

Card.displayName = 'Card';
