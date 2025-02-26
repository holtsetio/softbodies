import * as THREE from "three/webgpu";
import {noise3D} from "./common/noise";
import chroma from "chroma-js";
import {conf} from "./conf";

export class Lights {
    lights = [];

    lightNum = 4;

    constructor() {
        this.object = new THREE.Object3D();
        const light = new THREE.SpotLight(0xffffff, 5, 0, Math.PI * 0.25, 1, 0);
        const lightTarget = new THREE.Object3D();
        light.position.set(20, 10, 40);
        lightTarget.position.set(0,-15,0);
        light.target = lightTarget;

        this.object.add(light);
        this.object.add(new THREE.SpotLightHelper(light));

        light.castShadow = true; // default false
        light.shadow.mapSize.width = 512*2; // default
        light.shadow.mapSize.height = 512*2; // default
            /*light.shadow.camera.near = 0.5; // default
            light.shadow.camera.far = 500;*/

    }

    update(elapsed) {

    }
}