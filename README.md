# LED Underlayer Color Demo

A Web Bluetooth controller for LED Underlayer Hair Color, built on the UGOKU-Pad BLE protocol
(19-byte packets: 9 × (channel, value) + XOR checksum, flushed every 50 ms).

## Usage

```
https://<host>/?mac=AA:BB:CC:DD:EE:FF
```

| Channel | Direction | Item | Range |
| --- | --- | --- | --- |
| 1 | out | Power | 0 / 1 |
| 2 | out | Brightness | 0-255 |
| 3 | out | Hue | 0-255 |
| 4 | out | Speed | 0-255 |
| 5 | out | Mode (0 Breath, 1 Wipe, 2 Rainbow, 3 Theater Chase, 4 Sparkle, 5 Solid) | 0-5 |
| 6 | in | Battery | 0-100 |

Web Bluetooth cannot connect to a device by MAC address. The first connection uses the
picker (filtered by the UGOKU service UUID); the chosen device is then remembered under the
`mac` key and reconnected automatically (on drop, and on reload where
`navigator.bluetooth.getDevices()` is available). All outputs are re-sent on every connect.

## Development

```bash
bun install
bun run dev
bun run build
```
