<script lang="ts">
  let { level }: { level: number | null } = $props()

  // Inner fill area of the pixel battery is 12 x 6 cells.
  const fill = $derived(level === null ? 0 : Math.round((Math.max(0, Math.min(100, level)) / 100) * 12))
  const low = $derived(level !== null && level <= 20)
</script>

<div class="flex items-center gap-2" aria-label="Battery {level ?? 'unknown'} percent">
  <svg viewBox="0 0 18 10" width="54" height="30" shape-rendering="crispEdges" aria-hidden="true" class:blink={low}>
    <path d="M0 0h16v1h-16zM0 9h16v1h-16zM0 1h1v8h-1zM15 1h1v8h-1zM16 3h2v4h-2z" fill="currentColor" />
    {#if fill > 0}
      <rect x="2" y="2" width={fill} height="6" fill="currentColor" />
    {/if}
  </svg>
  <span class="w-[4ch] text-right text-2xl tabular-nums">{level === null ? '--' : level}%</span>
</div>
