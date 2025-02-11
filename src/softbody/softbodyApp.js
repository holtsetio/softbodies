import * as THREE from "three/webgpu";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import Stats from "three/examples/jsm/libs/stats.module"
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import {conf} from "./conf";
import {Lights} from "./lights";

//import hdrjpg from "../assets/clear_sky_afternoon_sky_dome_2k.jpg";
import hdri from "../assets/syferfontein_1d_clear_puresky_1k.hdr";

import {Fn, normalWorld, pmremTexture, vec3} from "three/tsl";
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

    bloomEnabled = false;

    lights = null;

    stats = null;

    bloomPass = null;

    composer = null;

    physics = null;

    cloth = null;

    vertexVisualizer = null;

    springVisualizer = null;

    constructor(renderer) {
        this.renderer = renderer;
    }

    async init(progressCallback) {
        this.time = 0;
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
        this.camera.position.set(0,0, -15);
        this.camera.lookAt(0,0,0);
        this.camera.updateProjectionMatrix()

        this.scene = new THREE.Scene();

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        await progressCallback(0.1)

        const hdriTexture = await loadHdr(hdri);
        //this.scene.environment = hdriTexture;
        this.scene.backgroundNode = pmremTexture(hdriTexture, normalWorld);
        this.scene.environmentNode = pmremTexture(hdriTexture, normalWorld);
        //this.scene.backgroundBlurriness = 0.1;
        //this.scene.backgroundRotation.set(0, Math.PI, 0);
        //this.scene.environmentRotation.set(0, Math.PI, 0);
        //this.scene.backgroundNode = Fn(() => { return vec3(0); })();
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.5;

        await progressCallback(0.5)

        this.lights = new Lights();
        this.scene.add(this.lights.object);

        const w = 128;
        const h = 64;


        this.physics = new FEMPhysics(this.renderer);
        this.physics.addObject(SoftbodyModel);
        for (let i=0; i<10; i++) {
            const softbody = new SoftbodyModel(this.physics, new THREE.Vector3((Math.random()-0.5)*10,4+Math.random()*2,0));
            this.scene.add(softbody.object);
        }

        this.collisionGeometry = new CollisionGeometry(this.physics);
        this.scene.add(this.collisionGeometry.object);

        await this.physics.bake();



        this.tetVisualizer = new TetVisualizer(this.physics);
        //this.scene.add(this.tetVisualizer.object);
        /*
        this.collisionGeometry = new CollisionGeometry();
        this.scene.add(this.collisionGeometry.object);

        this.physics = new VerletPhysics(this.renderer);
        this.physics.addObject(this.collisionGeometry);
        this.physics.addForceModifier(this.collisionGeometry.forceModifier);

        this.blob = new SoftbodyBlob(this.physics);

        await this.physics.bake();*/


        /*this.cloth = new Cloth(this.physics, w, h);
        this.cloth.setCamera(this.camera);
        await this.cloth.init();
        this.scene.add(this.cloth.object);*/
        //this.cloth.object.rotation.set(0,Math.PI * 0.5, 0);

        /*this.vertexVisualizer = new VertexVisualizer(this.physics);
        this.scene.add(this.vertexVisualizer.object);
        this.springVisualizer = new SpringVisualizer(this.physics);
        this.scene.add(this.springVisualizer.object);*/

        //this.scene.add(this.physics.collisionGeometry.object);
        //this.physics.collisionGeometry.setCamera(this.camera);

        /*const sphereGeometry = new THREE.SphereGeometry(0.8);
        this.sphere = new THREE.Mesh(sphereGeometry, new THREE.MeshStandardMaterial());
        this.scene.add(this.sphere);*/

        /*this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.1, 0.4, 0.0);
        const renderScene = new RenderPass(this.scene, this.camera);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);*/

        this.stats = new Stats();
        this.stats.showPanel(0); // Panel 0 = fps
        this.stats.domElement.style.cssText = "position:absolute;top:0px;left:0px;";
        this.renderer.domElement.parentElement.appendChild(this.stats.domElement);

        //this.renderer.domElement.addEventListener("pointermove", (event) => { this.physics.collisionGeometry.onMouseMove(event); });

        await progressCallback(1.0, 100);
    }

    resize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    async update(delta, elapsed) {
        conf.update();
        this.controls.update(delta);
        this.stats.update();
        this.time += 0.01666;
        //this.cloth.update();
        this.lights.update(elapsed);
        await this.physics.update(delta, elapsed);

        await this.renderer.renderAsync(this.scene, this.camera);
    }
}
export default SoftbodyApp;
