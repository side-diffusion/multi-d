<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';


    let modelID = $state('');


    function setMaterial(){

          let modelViewer = document.querySelector('model-viewer#babel');
          if(window.innerWidth > window.innerHeight){
            modelViewer.style.width = window.innerWidth*0.8  + 'px';
            modelViewer.style.height = window.innerWidth*0.8  + 'px';
          }else{
            modelViewer.style.width = window.innerHeight*0.8  + 'px';
            modelViewer.style.height = window.innerHeight*0.8  + 'px';
          }


        if(modelViewer){
            modelViewer.addEventListener('load', (ev) => {
                let material = modelViewer.model.materials[0];
                material.pbrMetallicRoughness.setBaseColorFactor([0.0, 0.0, 0.0]);
                material.pbrMetallicRoughness.setMetallicFactor(1.0);
                material.pbrMetallicRoughness.setRoughnessFactor(0.1);
                modelViewer.scale = '2 2 2'
                modelViewer.autoRotate = true;
                modelViewer.updateFraming();
            });
        }
    }


    // Load the model-viewer script
    onMount(() => {

        let parmas = $page.params;
        console.log(parmas);
         modelID = parmas.slug;


        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
        document.head.appendChild(script);

setMaterial()
    });
</script>

<div class="modellist">

    <model-viewer id="babel"
        src={`https://pub-57a66bc8ca6f480c99bd8b2a0f993f6a.r2.dev/${modelID}.glb`}
        alt="3D model viewer"
        loading="eager"
        environment-image="neutral"
        shadow-intensity="1"
    
        auto-rotate
        ar 
        ar-modes="scene-viewer quick-look"
        ar-scale="auto"
        xr-environment
        disable-zoom
    >

     <button slot="ar-button" class="ar-button">
      VIEW IN AR
  </button>
</model-viewer>
</div>

<style>
    .modellist {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100svw;
        height:  100svh;
     
        box-sizing: border-box;
        overflow: hidden;
     
    }

    model-viewer {
        width: 80%;
        height: 80%;
       
        background: none;
    }

    .ar-button {
        font-size: 14px;
        background:none;
        padding: 10px 20px;
        color: white;
        border-radius: 4px;
        border: 1px solid white;
        position: absolute;
        bottom: 42px;
        right: 50%;
        transform: translateX(50%);
    }
</style>