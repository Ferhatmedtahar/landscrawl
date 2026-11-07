import type { TimeOfDay } from './types'

export interface SkyColors { top: string; bottom: string; ridge: string[] }

const SKY: Record<TimeOfDay, SkyColors> = {
  dawn:   { top: '#6f7fb5', bottom: '#f6c3a0', ridge: ['#b9a3b8', '#8d84a8', '#5f5b86'] },
  day:    { top: '#5aa0dc', bottom: '#cfe8f5', ridge: ['#a5bccf', '#7f9bb4', '#58768f'] },
  sunset: { top: '#4a3f7a', bottom: '#f29a5c', ridge: ['#a8728a', '#7a5776', '#4a3b5e'] },
  dusk:   { top: '#1f2552', bottom: '#8a5c8e', ridge: ['#5c4f7e', '#3f3a66', '#272a4d'] },
  night:  { top: '#080b1e', bottom: '#243059', ridge: ['#2b3560', '#1d2547', '#121730'] },
}

export function skyColors(time: TimeOfDay | null): SkyColors {
  return SKY[time ?? 'day']
}
