import * as THREE from "three/webgpu";

export class Lights {
    lights = [];

    constructor() {
        this.object = new THREE.Object3D();
        const light = new THREE.SpotLight(0xffffff, 5, 0, Math.PI * 0.25, 1, 0);
        const lightTarget = new THREE.Object3D();
        light.position.set(30, 10, 50);
        lightTarget.position.set(10,-10,10);
        light.target = lightTarget;

        this.object.add(light);
        this.object.add(lightTarget);
        //this.object.add(new THREE.SpotLightHelper(light));

        light.castShadow = true; // default false
        light.shadow.mapSize.width = 512*2; // default
        light.shadow.mapSize.height = 512*2; // default
            /*light.shadow.camera.near = 0.5; // default
            light.shadow.camera.far = 500;*/

    }

    update(elapsed) {

    }
}