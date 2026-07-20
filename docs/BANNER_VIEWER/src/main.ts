import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";

const container = document.getElementById("viewer-container")!;

const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);

const world = worlds.create<
  OBC.SimpleScene,
  OBC.SimpleCamera,
  OBF.PostproductionRenderer
>();

world.name = "Banner";
world.scene = new OBC.SimpleScene(components);
world.scene.setup();

// Set transparent background
world.scene.three.background = null;
world.scene.three.environment = null;

world.renderer = new OBF.PostproductionRenderer(components, container);
world.renderer.three.setClearColor(0x000000, 0);

world.camera = new OBC.SimpleCamera(components);
world.camera.controls.setLookAt(10, 10, 10, 0, 0, 0);

components.init();

world.renderer.postproduction.enabled = true;
world.renderer.postproduction.style = OBF.PostproductionAspect.COLOR_SHADOWS;
world.renderer.postproduction.aoPass.updateGtaoMaterial({
  radius: 0.25,
  distanceExponent: 1,
  thickness: 1,
  scale: 1,
  samples: 16,
  distanceFallOff: 1,
  screenSpaceRadius: true,
});

world.camera.updateAspect();

// Fragments setup
const fragments = components.get(OBC.FragmentsManager);

// Auto rotation variables
let isModelLoaded = false;

async function loadModel() {
  try {
    const fileUrl = "../models/banner_model/MODELO_MUESTRA.frag";
    const response = await fetch(fileUrl);
    if(!response.ok) throw new Error("Could not fetch model");
    const data = await response.arrayBuffer();
    const buffer = new Uint8Array(data);
    const model = await fragments.load(buffer);
    
    world.scene.three.add(model);
    
    // Auto fit camera
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    // move camera
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    world.camera.controls.setLookAt(
      center.x + maxDim, 
      center.y + maxDim, 
      center.z + maxDim, 
      center.x, center.y, center.z
    );

    isModelLoaded = true;
  } catch (error) {
    console.error("Error loading banner model:", error);
  }
}

loadModel();

// Auto rotation loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  if(isModelLoaded) {
    // Slowly orbit the camera around the target
    world.camera.controls.azimuthAngle += 10 * clock.getDelta() * Math.PI / 180;
  }
}

animate();

window.addEventListener('resize', () => {
    world.renderer?.resize();
    world.camera.updateAspect();
});
