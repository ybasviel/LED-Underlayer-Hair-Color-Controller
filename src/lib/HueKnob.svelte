<script lang="ts">
  import { onMount } from 'svelte'
  import { hsv, hueToDeg, parseHex, type RGB } from './color'

  let { value = $bindable(0), size = 300 }: { value?: number; size?: number } = $props()

  // The wheel is rendered at a low resolution and scaled up for a pixel look.
  const N = 40
  const C = N / 2
  const RING_OUTER = 18.5
  const RING_INNER = 11.5
  const DISC = 7.5
  const EDGE = 1
  const HANDLE_RADIUS = (RING_OUTER + RING_INNER) / 2
  const HANDLE = 9

  // Rounded square: corners are cut off pixel by pixel.
  const inHandle = (i: number, j: number) =>
    i >= 0 && j >= 0 && i < HANDLE && j < HANDLE && Math.min(i, HANDLE - 1 - i) + Math.min(j, HANDLE - 1 - j) >= 2
  const WHITE: RGB = [255, 255, 255]

  let canvas: HTMLCanvasElement
  let edgeColor: RGB = [55, 65, 81]
  let dragging = $state(false)

  function readEdgeColor() {
    edgeColor = parseHex(getComputedStyle(canvas).getPropertyValue('--edge'), edgeColor)
  }

  // Draws a fixed hue wheel (red at 12 o'clock, clockwise) with a white handle on the selected hue.
  function draw(hueValue: number) {
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    const deg = hueToDeg(hueValue)
    const selected = hsv(deg)
    const img = ctx.createImageData(N, N)

    const put = (x: number, y: number, rgb: RGB) => {
      if (x < 0 || y < 0 || x >= N || y >= N) return
      const i = (y * N + x) * 4
      img.data[i] = rgb[0]
      img.data[i + 1] = rgb[1]
      img.data[i + 2] = rgb[2]
      img.data[i + 3] = 255
    }

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const dx = x + 0.5 - C
        const dy = y + 0.5 - C
        const d = Math.hypot(dx, dy)
        let rgb: RGB | null = null

        if (d <= RING_OUTER && d >= RING_INNER) {
          const onEdge = d > RING_OUTER - EDGE || d < RING_INNER + EDGE
          // Screen angle measured clockwise from 12 o'clock.
          const angle = (Math.atan2(dx, -dy) * 180) / Math.PI
          rgb = onEdge ? edgeColor : hsv(angle)
        } else if (d <= DISC) {
          rgb = d > DISC - EDGE ? edgeColor : selected
        }

        if (rgb) put(x, y, rgb)
      }
    }

    // Handle: drop shadow, edge outline, solid white body.
    const rad = (deg * Math.PI) / 180
    const left = Math.round(C + HANDLE_RADIUS * Math.sin(rad) - HANDLE / 2)
    const top = Math.round(C - HANDLE_RADIUS * Math.cos(rad) - HANDLE / 2)
    for (let j = 0; j < HANDLE; j++) {
      for (let i = 0; i < HANDLE; i++) {
        if (inHandle(i, j)) put(left + i + 1, top + j + 1, edgeColor)
      }
    }
    for (let j = 0; j < HANDLE; j++) {
      for (let i = 0; i < HANDLE; i++) {
        if (!inHandle(i, j)) continue
        const outline = !inHandle(i - 1, j) || !inHandle(i + 1, j) || !inHandle(i, j - 1) || !inHandle(i, j + 1)
        put(left + i, top + j, outline ? edgeColor : WHITE)
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  $effect(() => draw(value))

  onMount(() => {
    readEdgeColor()
    draw(value)
    const media = matchMedia('(prefers-color-scheme: dark)')
    const onScheme = () => {
      readEdgeColor()
      draw(value)
    }
    media.addEventListener('change', onScheme)
    return () => media.removeEventListener('change', onScheme)
  })

  function pointerAngle(e: PointerEvent): number | null {
    const rect = canvas.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    // Ignore the center where the angle is unstable.
    if (Math.hypot(dx, dy) < rect.width * 0.08) return null
    return (Math.atan2(dx, -dy) * 180) / Math.PI
  }

  function onPointerDown(e: PointerEvent) {
    const angle = pointerAngle(e)
    if (angle === null) return
    canvas.setPointerCapture(e.pointerId)
    dragging = true
    setFromAngle(angle)
  }

  function setFromAngle(angle: number) {
    value = Math.round((((angle % 360) + 360) % 360) * 256 / 360) % 256
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return
    const angle = pointerAngle(e)
    if (angle === null) return
    setFromAngle(angle)
  }

  function onPointerUp() {
    dragging = false
  }

  function onKeyDown(e: KeyboardEvent) {
    const step = e.shiftKey ? 16 : 1
    const delta = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[e.key]
    if (delta === undefined) return
    e.preventDefault()
    value = (((value + delta) % 256) + 256) % 256
  }
</script>

<div class="flex flex-col items-center">
  <canvas
    bind:this={canvas}
    width={N}
    height={N}
    class="cursor-grab touch-none"
    class:cursor-grabbing={dragging}
    style:width="{size}px"
    style:height="{size}px"
    role="slider"
    tabindex="0"
    aria-label="Hue"
    aria-valuemin={0}
    aria-valuemax={255}
    aria-valuenow={value}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onkeydown={onKeyDown}
  ></canvas>
</div>
