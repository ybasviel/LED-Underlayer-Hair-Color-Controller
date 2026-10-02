<script lang="ts">
  import PixelIcon from './PixelIcon.svelte'
  import { icons } from './icons'

  let { value = $bindable(0) }: { value?: number } = $props()
</script>

<div class="grid grid-cols-2 gap-4" role="radiogroup" aria-label="Power">
  {#each [{ v: 0, label: 'Off' }, { v: 1, label: 'On' }] as option (option.v)}
    <button
      type="button"
      role="radio"
      aria-checked={value === option.v}
      class="pixel-btn flex h-16 items-center justify-center gap-3 text-2xl uppercase"
      onclick={() => (value = option.v)}
    >
      <PixelIcon art={option.v ? icons.solid : icons.power} size={28} class={option.v ? '' : 'opacity-60'} />
      {option.label}
    </button>
  {/each}
</div>
