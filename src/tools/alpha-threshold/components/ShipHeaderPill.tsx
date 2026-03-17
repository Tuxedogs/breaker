type Props = {
  label: string
  value: string
}

export function ShipHeaderPill({ label, value }: Props) {
  return (
    <div className="alpha-ship-header-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
