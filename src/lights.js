import * as THREE from "three/webgpu";

export class Lights {
    lights = [];

    constructor() {
        this.object = new THREE.Object3D();
        const light = new THREE.SpotLight(0xffffff, 5, 0, Math.PI * 0.075, 1, 0);
        const lightTarget = new THREE.Object3D();
        light.position.set(100, 70, 74);
        lightTarget.position.set(0,0,0);
        light.target = lightTarget;

        this.object.add(light);
        this.object.add(lightTarget);
        //this.object.add(new THREE.SpotLightHelper(light, new THREE.Color(0,0,0)));

        light.castShadow = true; // default false
        light.shadow.mapSize.width = 512*2*2; // default
        light.shadow.mapSize.height = 512*2*2; // default
        light.shadow.bias =  -0.00005;
            light.shadow.camera.near = 0.5; // default
            light.shadow.camera.far = 150;

    }

    update(elapsed) {

    }
}