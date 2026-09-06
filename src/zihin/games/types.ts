import type { Outcome } from '../components/GameShell'

export interface GameProps {
  level: number
  onFinish: (o: Outcome) => void
}
