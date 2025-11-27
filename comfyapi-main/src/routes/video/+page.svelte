<script>
	import { onMount } from "svelte";
    import Video from "$lib/components/VIDEO.svelte";
    import VideoEffect from "$lib/utils/videoEffect.svelte";

    let prompt = $state('');


    onMount(async () => {
        console.log("Video page mounted");
    })
</script>


<div>
    <Video prompt={prompt} />
   


</div>


<style>

</style>

