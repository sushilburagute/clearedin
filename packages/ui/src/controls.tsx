import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { CategoryMode } from '@clearedin/contracts';

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} />;
}

export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <p
      className={error ? 'ci-notice ci-error' : 'ci-notice'}
      role={error ? 'alert' : 'status'}
    >
      {children}
    </p>
  );
}

export function CategoryControl({
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: CategoryMode;
  disabled: boolean;
  onChange(value: CategoryMode): void;
}) {
  const id = useId();
  return (
    <div className="ci-category">
      <div>
        <label htmlFor={id}>{label}</label>
        <p id={`${id}-description`}>{description}</p>
      </div>
      <select
        id={id}
        aria-describedby={`${id}-description`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as CategoryMode)}
      >
        <option value="show">Show normally</option>
        <option value="hide">Hide</option>
        <option value="always_show">Always show</option>
      </select>
    </div>
  );
}
