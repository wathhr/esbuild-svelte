<script lang="ts">
  import Counter from './Counter.svelte';
  let test: HTMLHeadingElement;

  $effect(() => {
    console.log('Mounted');
    test.innerText = 'Mounted';
  });
</script>

<h1 bind:this={test}>Not mounted</h1>
<Counter />

<style>
  @import url('./wrapper.css');
</style>
