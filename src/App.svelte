<script lang="ts">
  import { onMount } from 'svelte'
  import Battery from './lib/Battery.svelte'
  import HueKnob from './lib/HueKnob.svelte'
  import ModeSelector from './lib/ModeSelector.svelte'
  import Panel from './lib/Panel.svelte'
  import PixelSlider from './lib/PixelSlider.svelte'
  import PowerSwitch from './lib/PowerSwitch.svelte'
  import StatusBar from './lib/StatusBar.svelte'
  import { CH, Controls } from './lib/controls.svelte'
  import { icons } from './lib/icons'
  import { UgokuLink, normalizeMac } from './lib/ugoku.svelte'

  const mac = normalizeMac(new URLSearchParams(location.search).get('mac'))
  const link = new UgokuLink(mac)
  const controls = new Controls()


  // Each output is sent as soon as it changes.
  $effect(() => link.send(CH.power, controls.power))
  $effect(() => link.send(CH.brightness, controls.brightness))
  $effect(() => link.send(CH.hue, controls.hue))
  $effect(() => link.send(CH.speed, controls.speed))
  $effect(() => link.send(CH.mode, controls.mode))
  $effect(() => controls.save())

  onMount(() => {
    // Push the full UI state on every (re)connect so the device matches the screen.
    const offConnect = link.onConnect(() => {
      for (const [ch, v] of controls.outputs()) link.send(ch, v)
    })
    const offValue = link.onValue((ch, v) => {
      if (ch === CH.battery) controls.battery = Math.min(100, v)
    })
    const onVisible = () => {
      if (document.visibilityState === 'visible') link.retryNow()
    }
    document.addEventListener('visibilitychange', onVisible)
    void link.restore()

    return () => {
      offConnect()
      offValue()
      document.removeEventListener('visibilitychange', onVisible)
    }
  })
</script>

<main class="mx-auto flex min-h-dvh max-w-[768px] flex-col gap-4 p-4 pr-5 pb-6">
  <header class="pixel-header flex items-center gap-4 px-4 py-3">
    <h1 class="min-w-0 text-3xl leading-tight font-bold uppercase">LED Underlayer Hair Color</h1>
    <div class="ml-auto">
      <Battery level={controls.battery} />
    </div>
  </header>

  <StatusBar {link} />

  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <div class="flex flex-col gap-4">
      <Panel title="Power" icon={icons.power}>
        <PowerSwitch bind:value={controls.power} />
      </Panel>
      <Panel title="Brightness" icon={icons.brightness}>
        <PixelSlider label="Brightness" bind:value={controls.brightness} />
      </Panel>
      <Panel title="Speed" icon={icons.speed}>
        <PixelSlider label="Speed" color="var(--color-accent)" bind:value={controls.speed} />
      </Panel>
    </div>

    <Panel title="Color" icon={icons.color} class="items-stretch">
      <div class="flex flex-1 items-center justify-center">
        <HueKnob bind:value={controls.hue} size={280} />
      </div>
      <p class="text-center text-sm text-(--muted) uppercase">Drag the handle</p>
    </Panel>
  </div>

  <Panel title="Mode" icon={icons.mode}>
    <ModeSelector bind:value={controls.mode} />
  </Panel>
</main>
