export const COLORS = [
  '#10b981', '#3b82f6', '#f43f5e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6',
  '#ef4444', '#fb923c', '#94a3b8', '#a78bfa',
]

interface ColorPickerProps {
  value: string | null
  onChange: (color: string) => void
  colors?: string[]
}

export function ColorPicker({ value, onChange, colors = COLORS }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer"
          style={{
            backgroundColor: c,
            borderColor: value === c ? 'white' : 'transparent',
            boxShadow: value === c ? `0 0 0 2px ${c}` : undefined,
          }}
        />
      ))}
    </div>
  )
}
