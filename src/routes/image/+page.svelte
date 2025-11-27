<script>
	import { onMount } from "svelte";
    import Image from "$lib/components/IMAGE.svelte";

    let prompt = $state('');


    onMount(async () => {
        console.log("Image page mounted");
    })
</script>


<div>
    <Image prompt={prompt} />



</div>


<style>

</style>

