export type WorkspaceTabOption<Value extends string> = {
  value: Value;
  label: string;
  count?: number;
};

export type WorkspaceTabsProps<Value extends string> = {
  options: readonly WorkspaceTabOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  label: string;
  className?: string;
  tabClassName?: string;
  activeClassName?: string;
  labelClassName?: string;
  countClassName?: string;
};

/** Shared accessible tabs; callers retain their own filtered data and CSS class names. */
export default function WorkspaceTabs<Value extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
  tabClassName = "",
  activeClassName = "is-active",
  labelClassName,
  countClassName,
}: WorkspaceTabsProps<Value>) {
  return (
    <div className={className} role="tablist" aria-label={label} data-workspace-tabs="">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={[tabClassName, value === option.value ? activeClassName : ""].filter(Boolean).join(" ")}
          onClick={() => onChange(option.value)}
        >
          <span className={labelClassName}>{option.label}</span>
          {option.count !== undefined && <span className={countClassName}>{option.count}</span>}
        </button>
      ))}
    </div>
  );
}
