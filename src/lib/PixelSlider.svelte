<script lang="ts">
  let {
    value = $bindable(0),
    max = 255,
    color = 'var(--color-main)',
    label,
  }: { value?: number; max?: number; color?: string; label: string } = $props()

  const THUMB = 32
  let track: HTMLDivElement

  const frac = $derived(value / max)

  function setFromPointer(clientX: number) {
    const rect = track.getBoundingClientRect()
    const x = (clientX - rect.left - THUMB / 2) / (rect.width - THUMB)
    value = Math.round(Math.max(0, Math.min(1, x)) * max)
  }

  function onPointerDown(e: PointerEvent) {
    track.setPointerCapture(e.pointerId)
    setFromPointer(e.clientX)
  }

  function onPointerMove(e: PointerEvent) {
    if (track.hasPointerCapture(e.pointerId)) setFromPointer(e.clientX)
  }

  function onKeyDown(e: KeyboardEvent) {
    const step = e.shiftKey ? 16 : 1
    const delta = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[e.key]
    if (delta === undefined) return
    e.preventDefault()
    value = Math.max(0, Math.min(max, value + delta))
  }
</script>

<div
  bind:this={track}
  class="pixel-well relative h-16 cursor-pointer touch-none"
  role="slider"
  tabindex="0"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={max}
  aria-valuenow={value}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onkeydown={onKeyDown}
>
  <div
    class="absolute inset-y-2 left-2"
    style:width="calc((100% - {THUMB}px) * {frac} + {THUMB / 2}px - 8px)"
    style:background="repeating-linear-gradient(90deg, {color} 0 12px, transparent 12px 16px)"
  ></div>
  <div
    class="absolute -inset-y-1 border-4 border-(--edge) bg-(--panel-bg)"
    style:width="{THUMB}px"
    style:left="calc((100% - {THUMB}px) * {frac})"
  >
    <div class="mx-auto mt-3 h-[calc(100%-24px)] w-1 bg-(--edge)"></div>
  </div>
</div>
