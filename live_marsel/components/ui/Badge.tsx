import { type HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'black' | 'yellow' | 'pink' | 'cyan' | 'lime' | 'red' | 'orange' | 'purple' | 'white';
}

const VARIANT = {
  black:  'bg-nb-black text-white',
  yellow: 'bg-nb-yellow text-nb-black',
  pink:   'bg-nb-pink text-nb-black',
  cyan:   'bg-nb-cyan text-nb-black',
  lime:   'bg-nb-lime text-nb-black',
  red:    'bg-nb-red text-white',
  orange: 'bg-nb-orange text-nb-black',
  purple: 'bg-nb-purple text-nb-black',
  white:  'bg-white text-nb-black',
};

export const Badge = ({ className = '', variant = 'black', children, ...props }: BadgeProps) => (
  <span
    className={
      `inline-flex items-center gap-1 px-2 py-0.5 ` +
      `border-2 border-nb-black ${VARIANT[variant]} ` +
      `font-display uppercase tracking-tight text-xs ` +
      `${className}`
    }
    {...props}
  >
    {children}
  </span>
);
