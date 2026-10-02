<script lang="ts">
  import PixelIcon from './PixelIcon.svelte'
  import { icons } from './icons'
  import type { UgokuLink } from './ugoku.svelte'

  let { link }: { link: UgokuLink } = $props()

  const view = $derived.by(() => {
    switch (link.status) {
      case 'connected':
        return { text: 'Connected', color: 'text-ok', blink: false }
      case 'connecting':
      case 'requesting':
        return { text: 'Connecting...', color: 'text-main', blink: true }
      case 'reconnecting':
        return { text: `Reconnecting... #${link.retryCount}`, color: 'text-main', blink: true }
      case 'unsupported':
        return { text: 'Bluetooth unavailable', color: 'text-danger', blink: false }
      default:
        return { text: 'Not connected', color: 'text-(--muted)', blink: false }
    }
  })
</script>

<section class="pixel-panel flex items-center gap-3 px-4 py-3">
  <PixelIcon art={icons.bluetooth} size={32} class="{view.color} {view.blink ? 'blink' : ''}" />
  <div class="flex min-w-0 flex-col leading-tight">
    <span class="text-xl uppercase {view.color}">{view.text}</span>
    <span class="truncate text-sm text-(--muted)">
      {#if link.status === 'unsupported'}
        USE CHROME (ANDROID / DESKTOP) OR BLUEFY (iPadOS)
      {:else if link.deviceName}
        {link.deviceName}
      {/if}
    </span>
  </div>
  {#if link.status !== 'unsupported'}
    <button
      type="button"
      class="pixel-btn-accent ml-auto flex shrink-0 items-center gap-2 px-4 py-2 text-lg uppercase"
      onclick={() => link.request()}
    >
      <PixelIcon art={icons.bluetooth} size={20} />
      {link.status === 'idle' || link.status === 'requesting' ? 'Connect' : 'Change'}
    </button>
  {/if}
</section>
