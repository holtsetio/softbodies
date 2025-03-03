import * as THREE from "three/webgpu";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import Stats from "three/examples/jsm/libs/stats.module"
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import {Lights} from "./lights";

//import hdrjpg from "../assets/clear_sky_afternoon_sky_dome_2k.jpg";
import hdri from "../assets/syferfontein_1d_clear_puresky_1k.hdr";

import {Fn, fog, normalWorld, pmremTexture, rangeFogFactor, vec3} from "three/tsl";
import {SoftbodyModel} from "./softbodyModel";
import {FEMPhysics} from "./FEMPhysics/FEMPhysics";
import {TetVisualizer} from "./FEMPhysics/tetVisualizer";
import CollisionGeometry from "./collisionGeometry";

const loadHdr = async (file) => {
    const texture = await new Promise(resolve => {
        new RGBELoader().load(file, result => { resolve(result); });
    });
    return texture;
}

class SoftbodyApp {
    renderer = null;

    camera = null;

    scene = null;

    controls = null;

    lights = null;

    stats = null;

    physics = null;

    softbodies = [];

    softbodyCount = 15;

    lastSoftbody = 0;

    constructor(renderer) {
        this.renderer = renderer;
    }

    async init(progressCallback) {
        this.time = 0;
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
        this.camera.position.set(30,10, 27);
        this.camera.lookAt(0,0,0);
        this.camera.updateProjectionMatrix()

        this.scene = new THREE.Scene();

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.enablePan = false;
        this.controls.minDistance = 20;
        this.controls.maxDistance = 60;

        await progressCallback(0.1)

        const hdriTexture = await loadHdr(hdri);
        //this.scene.environment = hdriTexture;d
        this.scene.backgroundNode = pmremTexture(hdriTexture, normalWorld);
        this.scene.environmentNode = pmremTexture(hdriTexture, normalWorld); //.mul(normalWorld.y.add(1.0).min(1.0).mul(0.8).add(0.2));
        //this.scene.fogNode = Fn(() => { return fog(pmremTexture(hdriTexture, normalWorld), rangeFogFactor(30,50)); })() ; //.mul(normalWorld.y.add(1.0).min(1.0).mul(0.8).add(0.2));
        //this.scene.backgroundBlurriness = 0.1;
        //this.scene.backgroundRotation.set(0, Math.PI, 0);
        //this.scene.environmentRotation.set(0, Math.PI, 0);
        //this.scene.backgroundNode = Fn(() => { return vec3(0); })();
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.5;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        await progressCallback(0.5)

        this.lights = new Lights();
        this.scene.add(this.lights.object);


        this.physics = new FEMPhysics(this.renderer);
        //this.physics.addObject(SoftbodyModel);
        await SoftbodyModel.loadTextures();
        await SoftbodyModel.createMaterial(this.physics);
        for (let i=0; i<this.softbodyCount; i++) {
            const softbody = new SoftbodyModel(this.physics);
            this.scene.add(softbody.object);
            this.softbodies.push(softbody);
        }

        this.collisionGeometry = new CollisionGeometry(this.physics);
        await this.collisionGeometry.createGeometry();
        this.scene.add(this.collisionGeometry.object);

        this.collisionGeometry.floor.material.fogNode = fog(pmremTexture(hdriTexture, normalWorld), rangeFogFactor(10,50)); //.mul(normalWorld.y.add(1.0).min(1.0).mul(0.8).add(0.2));

        await this.physics.bake();



        this.tetVisualizer = new TetVisualizer(this.physics);
        //this.scene.add(this.tetVisualizer.object);

        this.stats = new Stats();
        this.stats.showPanel(0); // Panel 0 = fps
        this.stats.domElement.style.cssText = "position:absolute;top:0px;left:0px;";
        this.renderer.domElement.parentElement.appendChild(this.stats.domElement);

        this.raycaster = new THREE.Raycaster();
        this.renderer.domElement.addEventListener("pointerdown", (event) => { this.onPointerDown(event); });

        await progressCallback(1.0, 100);
    }

    async onPointerDown(event) {
        const pointer = new THREE.Vector2();
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(pointer, this.camera);
        await this.physics.onPointerDown(this.camera.position, this.raycaster.ray.direction);
        //Medusa.setMouseRay(this.raycaster.ray.direction);
    }

    resize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    async update(delta, elapsed) {
        //console.log(this.camera.position);
        //conf.update();
        this.controls.update(delta);

        const camZ = this.camera.position.z;
        const minY = -camZ * (3/5);
        const angle = Math.atan2(this.camera.position.length(), minY);
        this.controls.maxPolarAngle = angle - 0.2;

        this.stats.update();
        this.time += 0.01666;

        this.lastSoftbody += delta;
        if (this.lastSoftbody > 1.0) {
            const nextSoftbody = this.softbodies.find(sb => sb.outOfSight);
            if (nextSoftbody) {
                this.lastSoftbody = Math.random() * -1.0;
                await nextSoftbody.reset();
            }
        }
        //this.cloth.update();
        this.lights.update(elapsed);
        await this.physics.update(delta, elapsed);

        await this.renderer.renderAsync(this.scene, this.camera);
    }
}
export default SoftbodyApp;
