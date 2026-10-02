<script lang="ts">
  import PixelIcon from './PixelIcon.svelte'
  import { MODES } from './controls.svelte'

  let { value = $bindable(0) }: { value?: number } = $props()
</script>

<div class="grid grid-cols-3 gap-4 pr-1 pb-1" role="radiogroup" aria-label="Mode">
  {#each MODES as mode (mode.value)}
    <button
      type="button"
      role="radio"
      aria-checked={value === mode.value}
      class="pixel-btn flex h-24 flex-col items-center justify-center gap-2 px-2 text-center text-lg leading-tight uppercase"
      onclick={() => (value = mode.value)}
    >
      <PixelIcon art={mode.icon} size={40} />
      <span>{mode.label}</span>
    </button>
  {/each}
</div>
