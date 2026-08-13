export function SegmentToggle<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div className="inline-flex rounded-[3px] border border-line bg-paper p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-[2px] px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide transition-colors disabled:cursor-not-allowed ${value === o.value ? 'bg-pine text-paper' : 'text-moss hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}