<script>
    import { onMount } from 'svelte';
    import Modellist from '$lib/components/Modellist.svelte';

    onMount(() => { 
        console.log('Results page mounted');
    });
</script>

<div class="results">
    <Modellist />
</div>


<style>
    .results {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
</style>