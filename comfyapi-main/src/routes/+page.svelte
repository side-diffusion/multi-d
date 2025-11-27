<script>
    import { onMount } from "svelte";
    import ComfyGui from "$lib/components/ComfyGUI.svelte";
    import PROMPT from "$lib/components/PROMPT.svelte";



    onMount(()=>{
        console.log("main loaded")
    })

</script>

<PROMPT></PROMPT>

<style>

</style>