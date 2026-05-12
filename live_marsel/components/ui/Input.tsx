import { type InputHTMLAttributes, type SelectHTMLAttributes, forwardRef } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={
        `w-full px-4 py-2.5 bg-white text-nb-black ` +
        `border-[3px] border-nb-black shadow-nb-sm ` +
        `font-body font-semibold ` +
        `outline-none transition-all duration-100 ` +
        `focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-nb ` +
        `placeholder:text-nb-gray placeholder:font-normal ` +
        `${className}`
      }
      {...props}
    />
  ),
);
Input.displayName = 'Input';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', children, ...props }, ref) => (
    <select
      ref={ref}
      className={
        `w-full px-4 py-2.5 bg-white text-nb-black ` +
        `border-[3px] border-nb-black shadow-nb-sm ` +
        `font-body font-semibold cursor-pointer ` +
        `outline-none transition-all duration-100 ` +
        `focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-nb ` +
        `${className}`
      }
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
