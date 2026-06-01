import styles from './ChipsRow.module.css'

interface Chip {
  label: string
  value: string
}

interface Props {
  chips: Chip[]
  selected?: string
  onSelect: (value: string) => void
}

export default function ChipsRow({ chips, selected, onSelect }: Props) {
  return (
    <div className={styles.row}>
      {chips.map(chip => (
        <button
          key={chip.value}
          className={`${styles.chip} ${selected === chip.value ? styles.selected : ''}`}
          onClick={() => onSelect(selected === chip.value ? '' : chip.value)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}
