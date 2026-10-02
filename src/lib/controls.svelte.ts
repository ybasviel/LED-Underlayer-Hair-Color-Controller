import type { PixelArt } from './icons'
import { icons } from './icons'

/** UGOKU-Pad channel assignment. */
export const CH = {
  power: 1,
  brightness: 2,
  hue: 3,
  speed: 4,
  mode: 5,
  battery: 6,
} as const

export interface ModeDef {
  value: number
  label: string
  icon: PixelArt
}

export const MODES: ModeDef[] = [
  { value: 0, label: 'Breath', icon: icons.breath },
  { value: 1, label: 'Wipe', icon: icons.wipe },
  { value: 2, label: 'Rainbow', icon: icons.rainbow },
  { value: 3, label: 'Theater Chase', icon: icons.theaterChase },
  { value: 4, label: 'Sparkle', icon: icons.sparkle },
  { value: 5, label: 'Solid', icon: icons.solid },
]

const STORAGE_KEY = 'led-underlayer:controls'

interface Saved {
  power: number
  brightness: number
  hue: number
  speed: number
  mode: number
}

function load(): Partial<Saved> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export class Controls {
  power = $state(1)
  brightness = $state(128)
  hue = $state(0)
  speed = $state(128)
  mode = $state(5)
  /** Battery level 0-100 reported by the device; null until received. */
  battery = $state<number | null>(null)

  constructor() {
    const saved = load()
    if (saved.power !== undefined) this.power = saved.power
    if (saved.brightness !== undefined) this.brightness = saved.brightness
    if (saved.hue !== undefined) this.hue = saved.hue
    if (saved.speed !== undefined) this.speed = saved.speed
    if (saved.mode !== undefined) this.mode = saved.mode
  }

  /** Output channel/value pairs in send order. */
  outputs(): [number, number][] {
    return [
      [CH.power, this.power],
      [CH.brightness, this.brightness],
      [CH.hue, this.hue],
      [CH.speed, this.speed],
      [CH.mode, this.mode],
    ]
  }

  save() {
    const data: Saved = {
      power: this.power,
      brightness: this.brightness,
      hue: this.hue,
      speed: this.speed,
      mode: this.mode,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Persistence is optional.
    }
  }
}
