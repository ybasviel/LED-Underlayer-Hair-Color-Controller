/**
 * Web Bluetooth client for the UGOKU-Pad protocol.
 *
 * Packet format (19 bytes, compatible with UGOKU-Pad / UGOKU-Pad_Arduino):
 *   [ch0, val0, ch1, val1, ... ch8, val8, xor]
 * xor is the XOR of bytes 0..17. 0xFF marks an unused slot.
 * Pending values are flushed every 50 ms.
 *
 * Web Bluetooth cannot address a device by MAC address, so the MAC from the
 * URL is used as a key: the first connection is picked by the user, then the
 * browser-assigned device id is remembered for that MAC and reused to
 * reconnect automatically.
 */

export const UGOKU_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b'
export const UGOKU_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8'

export type LinkStatus =
  | 'unsupported'
  | 'idle'
  | 'requesting'
  | 'connecting'
  | 'connected'
  | 'reconnecting'

const PACKET_SIZE = 19
const PAIRS = 9
const UNUSED = 0xff
const SEND_INTERVAL_MS = 50
const CONNECT_TIMEOUT_MS = 10_000
const RETRY_BASE_MS = 1_000
const RETRY_MAX_MS = 8_000
const STORAGE_KEY = 'led-underlayer:device-ids'

type ValueListener = (channel: number, value: number) => void

/** Normalizes "aabbccddeeff" / "AA-BB-..." into "AA:BB:CC:DD:EE:FF". */
export function normalizeMac(raw: string | null): string | null {
  if (!raw) return null
  const hex = raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase()
  if (hex.length !== 12) return null
  return hex.match(/.{2}/g)!.join(':')
}

function loadDeviceIds(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveDeviceId(key: string, id: string) {
  try {
    const ids = loadDeviceIds()
    ids[key] = id
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Storage may be unavailable (private mode); reconnect still works in-session.
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Connection timed out')), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

export class UgokuLink {
  status = $state<LinkStatus>('idle')
  deviceName = $state<string | null>(null)
  retryCount = $state(0)
  lastError = $state<string | null>(null)

  readonly mac: string | null

  private device: BluetoothDevice | null = null
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null
  private pending = new Map<number, number>()
  private rxBuffer: number[] = []
  private sendTimer: ReturnType<typeof setInterval> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  /** Device whose connection attempt is in flight, if any. */
  private openingFor: BluetoothDevice | null = null
  private flushing = false
  private valueListeners = new Set<ValueListener>()
  private connectListeners = new Set<() => void>()

  constructor(mac: string | null) {
    this.mac = mac
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      this.status = 'unsupported'
    }
  }

  private get storageKey() {
    return this.mac ?? 'default'
  }

  onValue(fn: ValueListener) {
    this.valueListeners.add(fn)
    return () => this.valueListeners.delete(fn)
  }

  /** Called every time a connection is (re)established. */
  onConnect(fn: () => void) {
    this.connectListeners.add(fn)
    return () => this.connectListeners.delete(fn)
  }

  /** Tries to reconnect to the device remembered for this MAC without a picker. */
  async restore(): Promise<boolean> {
    if (this.status === 'unsupported' || !navigator.bluetooth.getDevices) return false
    const id = loadDeviceIds()[this.storageKey]
    if (!id) return false
    try {
      const devices = await navigator.bluetooth.getDevices()
      const device = devices.find((d) => d.id === id)
      if (!device) return false
      this.attach(device)
      return true
    } catch (err) {
      console.warn('[BLE] getDevices failed', err)
      return false
    }
  }

  /**
   * Opens the device picker. Must be called synchronously from a user gesture.
   * Also used to switch to another device; the current one is kept if the picker is cancelled.
   */
  request(): Promise<void> {
    if (this.status === 'unsupported') return Promise.resolve()

    // Start the picker before any state update so the user activation is kept.
    const picker = navigator.bluetooth.requestDevice({
      filters: [{ services: [UGOKU_SERVICE_UUID] }],
      optionalServices: [UGOKU_SERVICE_UUID],
    })
    if (!this.device) this.status = 'requesting'
    this.lastError = null

    return picker
      .then((device) => {
        saveDeviceId(this.storageKey, device.id)
        this.attach(device)
      })
      .catch((err: Error) => {
        if (!this.device) this.status = 'idle'
        if (err.name !== 'NotFoundError') this.lastError = err.message
      })
  }

  send(channel: number, value: number) {
    if (!this.characteristic) return
    this.pending.set(channel & 0xff, Math.max(0, Math.min(0xff, Math.round(value))))
  }

  private attach(device: BluetoothDevice) {
    const previous = this.device
    if (previous === device && (this.characteristic || this.openingFor === device)) return

    if (previous && previous !== device) {
      // Switching devices: drop the old one without triggering a reconnect.
      previous.removeEventListener('gattserverdisconnected', this.handleDisconnected)
      this.clearRetry()
      this.teardown()
      if (previous.gatt?.connected) previous.gatt.disconnect()
    }
    this.device = device
    this.deviceName = device.name ?? null
    device.addEventListener('gattserverdisconnected', this.handleDisconnected)
    this.retryCount = 0
    void this.open()
  }

  private async open() {
    const device = this.device
    if (!device?.gatt || this.openingFor === device) return
    this.openingFor = device
    this.clearRetry()
    const superseded = () => this.device !== device
    this.status = this.retryCount > 0 ? 'reconnecting' : 'connecting'

    try {
      const server = await withTimeout(device.gatt.connect(), CONNECT_TIMEOUT_MS)
      const service = await server.getPrimaryService(UGOKU_SERVICE_UUID)
      const characteristic = await service.getCharacteristic(UGOKU_CHARACTERISTIC_UUID)
      if (superseded()) throw new Error('superseded')

      if (characteristic.properties.notify) {
        characteristic.addEventListener('characteristicvaluechanged', this.handleNotification)
        await characteristic.startNotifications()
      }
      if (superseded()) {
        characteristic.removeEventListener('characteristicvaluechanged', this.handleNotification)
        throw new Error('superseded')
      }

      this.characteristic = characteristic
      this.rxBuffer = []
      this.pending.clear()
      this.startSending()
      this.status = 'connected'
      this.retryCount = 0
      this.lastError = null
      this.connectListeners.forEach((fn) => fn())
    } catch (err) {
      if (device.gatt.connected) device.gatt.disconnect()
      // Another device was picked meanwhile; leave it alone.
      if (superseded()) return
      console.warn('[BLE] connect failed', err)
      this.lastError = (err as Error).message
      this.scheduleRetry()
    } finally {
      if (this.openingFor === device) this.openingFor = null
    }
  }

  private handleDisconnected = () => {
    this.teardown()
    if (!this.openingFor) this.scheduleRetry()
  }

  private teardown() {
    this.stopSending()
    if (this.characteristic) {
      this.characteristic.removeEventListener('characteristicvaluechanged', this.handleNotification)
      this.characteristic = null
    }
  }

  private scheduleRetry() {
    this.teardown()
    this.clearRetry()
    this.retryCount += 1
    this.status = 'reconnecting'
    const delay = Math.min(RETRY_BASE_MS * 2 ** (this.retryCount - 1), RETRY_MAX_MS)
    this.retryTimer = setTimeout(() => void this.open(), delay)
  }

  private clearRetry() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  /** Retries immediately, e.g. when the page becomes visible again. */
  retryNow() {
    if (this.status === 'reconnecting' && !this.openingFor) void this.open()
  }

  private handleNotification = (ev: Event) => {
    const data = (ev.target as BluetoothRemoteGATTCharacteristic).value
    if (!data) return
    for (let i = 0; i < data.byteLength; i++) this.rxBuffer.push(data.getUint8(i))

    while (this.rxBuffer.length >= PACKET_SIZE) {
      const packet = this.rxBuffer.splice(0, PACKET_SIZE)
      let xor = 0
      for (let i = 0; i < PACKET_SIZE - 1; i++) xor ^= packet[i]
      if (xor !== packet[PACKET_SIZE - 1]) continue

      for (let i = 0; i < PAIRS; i++) {
        const channel = packet[i * 2]
        const value = packet[i * 2 + 1]
        if (channel === UNUSED) continue
        this.valueListeners.forEach((fn) => fn(channel, value))
      }
    }
  }

  private startSending() {
    if (!this.sendTimer) this.sendTimer = setInterval(() => void this.flush(), SEND_INTERVAL_MS)
  }

  private stopSending() {
    if (this.sendTimer) {
      clearInterval(this.sendTimer)
      this.sendTimer = null
    }
    this.pending.clear()
  }

  private async flush() {
    const characteristic = this.characteristic
    if (this.flushing || !characteristic || this.pending.size === 0) return
    this.flushing = true

    const entries = [...this.pending.entries()]
    this.pending.clear()

    try {
      for (let offset = 0; offset < entries.length; offset += PAIRS) {
        const packet = new Uint8Array(PACKET_SIZE).fill(UNUSED)
        entries.slice(offset, offset + PAIRS).forEach(([channel, value], i) => {
          packet[i * 2] = channel
          packet[i * 2 + 1] = value
        })
        let xor = 0
        for (let i = 0; i < PACKET_SIZE - 1; i++) xor ^= packet[i]
        packet[PACKET_SIZE - 1] = xor

        if (characteristic.properties.writeWithoutResponse) {
          await characteristic.writeValueWithoutResponse(packet)
        } else {
          await characteristic.writeValueWithResponse(packet)
        }
      }
    } catch (err) {
      console.warn('[BLE] write failed', err)
    } finally {
      this.flushing = false
    }
  }
}
