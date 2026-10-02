<script lang="ts">
  import type { Snippet } from 'svelte'
  import PixelIcon from './PixelIcon.svelte'
  import type { PixelArt } from './icons'

  let {
    title,
    icon,
    value,
    class: cls = '',
    children,
  }: { title: string; icon: PixelArt; value?: string; class?: string; children: Snippet } = $props()
</script>

<section class="pixel-panel flex flex-col gap-2 px-4 py-3 {cls}">
  <h2 class="flex items-center gap-2 text-xl font-bold text-main uppercase">
    <PixelIcon art={icon} size={24} />
    <span>{title}</span>
    {#if value !== undefined}
      <span class="ml-auto font-sans text-2xl text-(--panel-fg) tabular-nums">{value}</span>
    {/if}
  </h2>
  {@render children()}
</section>
