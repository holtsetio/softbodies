import * as THREE from "three/webgpu";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
//import Stats from "three/examples/jsm/libs/stats.module"
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import {Lights} from "./lights";

//import hdrjpg from "../assets/clear_sky_afternoon_sky_dome_2k.jpg";
import hdri from "../assets/autumn_field_puresky_1k.hdr";

import {
    dot, float,
    Fn,
    fog,
    mix,
    normalView,
    normalWorld,
    pmremTexture,
    rangeFogFactor,
    smoothstep,
    varying,
    vec3
} from "three/tsl";
import {FEMPhysics} from "./FEMPhysics/FEMPhysics";
import {TetVisualizer} from "./FEMPhysics/tetVisualizer";
import CollisionGeometry from "./collisionGeometry";

import virus from './geometry/virus';
import skull from './geometry/skull3';
//import skullModel from 'bundle-text:./geometry/skull4.msh';
//import skullObj from 'bundle-text:./geometry/skull.obj';
//import {loadModel, processObj} from "./geometry/loadModel";

import normalMapFileVirus from './geometry/textures/virus_normal.png';
import roughnessMapFileVirus from './geometry/textures/virus_roughness.jpg';
import colorMapFileSkull from './geometry/textures/skullColor.jpg';
import normalMapFileSkull from './geometry/textures/skullNormal.png';
import roughnessMapFileSkull from './geometry/textures/skullRoughness.jpg';
import {conf} from "./conf";
import {Info} from "./info";
import {generateTube} from "./geometry/loadModel";

const loadHdr = async (file) => {
    const texture = await new Promise(resolve => {
        new RGBELoader().load(file, result => { resolve(result); });
    });
    return texture;
}
const textureLoader = new THREE.TextureLoader();
const loadTexture = (file) => {
    return new Promise(resolve => {
        textureLoader.load(file, texture => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            resolve(texture);
        });
    });
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

    softbodyCount = 150;

    lastSoftbody = 0;

    wireframe = false;

    constructor(renderer) {
        this.renderer = renderer;
    }

    async init(progressCallback) {
        conf.init();
        this.info = new Info();
        this.time = 0;
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 120);
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
        this.renderer.toneMappingExposure = 0.8;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        await progressCallback(0.5)

        this.lights = new Lights();
        this.scene.add(this.lights.object);


        this.physics = new FEMPhysics(this.renderer);
        //this.physics.addObject(SoftbodyModel);

        const tube = generateTube();
        const tubeGeometry = this.physics.addGeometry(tube)
        const virusGeometry = this.physics.addGeometry(virus);
        const skullGeometry = this.physics.addGeometry(skull);
        //const skullGeometry = this.physics.addGeometry(loadModel(skullModel,skullObj));

        {
            const mapFiles = [normalMapFileVirus, roughnessMapFileVirus];
            const [ virusNormalMap, virusRoughnessMap ] = await Promise.all(mapFiles.map(f => loadTexture(f)));
            virusGeometry.material.normalMap = virusNormalMap;
            virusGeometry.material.roughnessMap = virusRoughnessMap;
            virusGeometry.material.metalness = 0.4;
            virusGeometry.material.iridescence = 1.0;
            virusGeometry.material.color = 0xFFAAFF;
            virusGeometry.material.normalScale = new THREE.Vector2(3,3);

            virusGeometry.material.colorNode = Fn(() => {
                return vec3(0.5,0,0.5).mul(0.05);
            })();

            const vDistance = varying(float(0), "v_distance");
            virusGeometry.material.emissiveNode = Fn(() => {
                const dp = dot(vec3(0,0,1), normalView).max(0).pow(4);
                const color = vec3(1,0,0.5);
                const of = mix(0.0, 1.0, smoothstep(1.3,1.6, vDistance));
                return dp.mul(of).mul(color);
            })();
        }
        {
            const mapFiles = [colorMapFileSkull, normalMapFileSkull, roughnessMapFileSkull];
            const [ skullColorMap, skullNormalMap, skullRoughnessMap ] = await Promise.all(mapFiles.map(f => loadTexture(f)));
            skullGeometry.material.map = skullColorMap;
            skullGeometry.material.normalMap = skullNormalMap;
            skullGeometry.material.roughnessMap = skullRoughnessMap;
            skullGeometry.material.metalness = 1.0;
            skullGeometry.material.iridescence = 1.0;
        }

        for (let i=0; i<this.softbodyCount; i++) {
            const softbody = this.physics.addInstance(tubeGeometry); //i % 4 === 0 ? skullGeometry : virusGeometry);
            this.scene.add(softbody.object);
            this.softbodies.push(softbody);
        }
        /*for (let i=0; i<this.softbodyCount; i++) {
            const softbody = this.physics.addInstance(i % 20 === 19 ? virusGeometry : skullGeometry);
            this.scene.add(softbody.object);
            this.softbodies.push(softbody);
        }*/

        this.collisionGeometry = new CollisionGeometry(this.physics);
        await this.collisionGeometry.createGeometry();
        this.scene.add(this.collisionGeometry.object);

        this.collisionGeometry.floor.material.fogNode = fog(pmremTexture(hdriTexture, normalWorld), rangeFogFactor(10,50)); //.mul(normalWorld.y.add(1.0).min(1.0).mul(0.8).add(0.2));

        await this.physics.bake();

        for (let i=0; i<this.softbodyCount; i++) {
            const softbody = this.softbodies[i];
            await softbody.initPos();
            softbody.spawned = false;
        }


        this.tetVisualizer = new TetVisualizer(this.physics);
        this.tetVisualizer.object.visible = false;
        this.scene.add(this.tetVisualizer.object);

        /*this.stats = new Stats();
        this.stats.showPanel(0); // Panel 0 = fps
        this.stats.domElement.style.cssText = "position:absolute;top:0px;left:0px;";
        this.renderer.domElement.parentElement.appendChild(this.stats.domElement);*/

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
    }

    resize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    async update(delta, elapsed) {
        conf.begin();

        const { wireframe } = conf;
        if (wireframe !== this.wireframe) {
            this.wireframe = wireframe;
            this.softbodies.forEach(sb => { sb.object.visible = sb.spawned && !wireframe; })
            this.tetVisualizer.object.visible = wireframe;
        }


        //console.log(this.camera.position);
        //conf.update();
        this.controls.update(delta);

        const camZ = this.camera.position.z;
        const minY = -camZ * (3/5);
        const angle = Math.atan2(this.camera.position.length(), minY);
        this.controls.maxPolarAngle = angle - 0.2;

        //this.stats.update();
        this.time += 0.01666;

        this.lastSoftbody += delta;
        if (this.lastSoftbody > 1.0) {
            const nextSoftbody = this.softbodies.find(sb => sb.outOfSight);
            if (nextSoftbody) {
                this.lastSoftbody = Math.random() * -1.0;
                await nextSoftbody.reset();
                nextSoftbody.object.visible = !this.wireframe;
            }
        }
        //this.cloth.update();
        this.lights.update(elapsed);
        await this.physics.update(delta, elapsed);

        await this.renderer.renderAsync(this.scene, this.camera);

        conf.end();
    }
}
export default SoftbodyApp;
