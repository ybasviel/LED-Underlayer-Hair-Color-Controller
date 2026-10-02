<script lang="ts">
  import { toLayers, type PixelArt } from './icons'

  let { art, size = 24, class: cls = '' }: { art: PixelArt; size?: number; class?: string } = $props()

  const width = $derived(Math.max(...art.rows.map((r) => r.length)))
  const height = $derived(art.rows.length)
  const layers = $derived(toLayers(art))
</script>

<svg
  viewBox="0 0 {width} {height}"
  width={size}
  height={(size * height) / width}
  shape-rendering="crispEdges"
  aria-hidden="true"
  class="shrink-0 {cls}"
>
  {#each layers as layer (layer.fill)}
    <path d={layer.d} fill={layer.fill} />
  {/each}
</svg>
