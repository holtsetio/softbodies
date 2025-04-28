import * as THREE from "three/webgpu";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import {Lights} from "./lights";

import hdri from "./assets/autumn_field_puresky_1k.hdr";

import {
    dot, float,
    Fn,
    mix,
    normalView,
    normalWorld,
    pmremTexture,
    smoothstep, texture, uv, normalMap,
    varying, vec2,
    vec3
} from "three/tsl";
import {FEMPhysics} from "./FEMPhysics/FEMPhysics";
import {TetVisualizer} from "./FEMPhysics/tetVisualizer";
import CollisionGeometry from "./collisionGeometry";

import virus from './geometry/virus';
import skull from './geometry/skull3';
import icosphere from './geometry/icosphere';

import normalMapFileVirus from './geometry/textures/virus_normal.png';
import roughnessMapFileVirus from './geometry/textures/virus_roughness.jpg';
import colorMapFileSkull from './geometry/textures/skullColor.jpg';
import normalMapFileSkull from './geometry/textures/skullNormal.png';
import roughnessMapFileSkull from './geometry/textures/skullRoughness.jpg';

import normalMapFileRope from './geometry/textures/fabrics_0066_normal_opengl_1k.png';
import roughnessMapFileRope from './geometry/textures/fabrics_0066_roughness_1k.jpg';
import colorMapFileRope from './geometry/textures/fabrics_0066_color_1k.jpg';
import aoMapFileRope from './geometry/textures/fabrics_0066_ao_1k.jpg';

/*import earthColorFile from './geometry/textures/2k_earth_daymap.jpg';
import earthNormalFile from './geometry/textures/2k_earth_normal_map.png';
import earthSpecularFile from './geometry/textures/2k_earth_specular_map.png';*/

import {conf} from "./conf";
import {Info} from "./info";
import {generateTube} from "./geometry/loadModel";

const rope = generateTube(25);
const longRope = generateTube(500);

const loadHdr = async (file) => {
    const texture = await new Promise(resolve => {
        new RGBELoader().load(file, result => { resolve(result); });
    });
    return texture;
}
const textureLoader = new THREE.TextureLoader();

class App {
    renderer = null;

    camera = null;

    scene = null;

    controls = null;

    lights = null;

    stats = null;

    physics = null;

    softbodies = [];

    softbodyCount = 10;

    lastSoftbody = 0;

    wireframe = false;

    textures = {
        ropeNormal: normalMapFileRope,
        ropeColor: colorMapFileRope,
        ropeRoughness: roughnessMapFileRope,
        ropeAo: aoMapFileRope,
        virusNormal: normalMapFileVirus,
        virusRoughness: roughnessMapFileVirus,
        skullColor: colorMapFileSkull,
        skullRoughness: roughnessMapFileSkull,
        skullNormal: normalMapFileSkull,
    };

    constructor(renderer) {
        this.renderer = renderer;
    }

    async init(progressCallback) {
        conf.init();
        this.info = new Info();

        const texturePromises = Object.keys(this.textures).map(key => {
            const file = this.textures[key];
            return new Promise(resolve => {
                textureLoader.load(file, texture => {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    this.textures[key] = texture;
                    resolve();
                });
            });
        });
        await Promise.all(texturePromises);
        await progressCallback(0.2)
        this.textures.hdri = await loadHdr(hdri);
        await progressCallback(0.3)

        this.sceneName = conf.scene;
        await this.setupScene(progressCallback);

        this.raycaster = new THREE.Raycaster();
        this.renderer.domElement.addEventListener("pointerdown", (event) => { this.onPointerDown(event); });

        await progressCallback(1.0, 100);
    }

    async setupScene(progressCallback) {
        this.softbodyCount = conf.maxBodies;
        this.wireframe = false;

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 120);
        this.camera.position.set(30,10, 27);
        this.camera.lookAt(0,0,0);
        this.camera.updateProjectionMatrix()

        this.scene = new THREE.Scene();

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.enablePan = false;
        this.controls.minDistance = 20;
        this.controls.maxDistance = 100;
        this.controls.minPolarAngle = 0.2 * Math.PI;
        this.controls.maxPolarAngle = 0.8 * Math.PI;

        this.scene.backgroundNode = pmremTexture(this.textures.hdri, normalWorld);
        this.scene.environmentNode = pmremTexture(this.textures.hdri, normalWorld).mul(0.5);

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.5;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.lights = new Lights();
        this.scene.add(this.lights.object);

        this.physics = new FEMPhysics(this.renderer);
        this.scene.add(this.physics.object);


        const ropeGeometry = this.physics.addGeometry(rope)
        const longRopeGeometry = this.physics.addGeometry(longRope)
        const virusGeometry = this.physics.addGeometry(virus);
        const skullGeometry = this.physics.addGeometry(skull);
        const sphereGeometry = this.physics.addGeometry(icosphere);
        await progressCallback(0.5)

        {
            [ropeGeometry, longRopeGeometry].forEach((geometry) => {
                geometry.material.normalMap = this.textures.ropeNormal;
                geometry.material.roughnessMap = this.textures.ropeRoughness;
                geometry.material.aoMap = this.textures.ropeAo;
                geometry.material.map = this.textures.ropeColor;
                geometry.material.normalScale = new THREE.Vector2(3,3);
            });
        }
        {
            /*const mapFiles = [earthColorFile, earthNormalFile, earthSpecularFile];
            const [ colorMap, normalMapTexture, specularMap ] = await Promise.all(mapFiles.map(f => loadTexture(f)));
            sphereGeometry.material.normalNode = normalMap(texture(normalMapTexture), vec2(3,3));
            sphereGeometry.material.roughnessNode = texture(specularMap).oneMinus();
            sphereGeometry.material.colorNode = texture(colorMap);*/
            sphereGeometry.material.metalness = 0.39;
            sphereGeometry.material.roughness = 0.45;
            sphereGeometry.material.color = new THREE.Color(0,0.8,1);
        }
        {
            virusGeometry.material.normalMap = this.textures.virusNormal;
            virusGeometry.material.roughnessMap = this.textures.virusRoughness;
            virusGeometry.material.metalness = 0.4;
            virusGeometry.material.iridescence = 1.0;
            virusGeometry.material.color = 0xFFAAFF;
            virusGeometry.material.normalScale = new THREE.Vector2(3,3);

            virusGeometry.material.colorNode = Fn(() => {
                return vec3(0.5,0,0.5).mul(0.5);
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
            skullGeometry.material.map = this.textures.skullColor;
            skullGeometry.material.normalMap = this.textures.skullNormal;
            skullGeometry.material.roughnessMap = this.textures.skullRoughness;
            skullGeometry.material.metalness = 1.0;
            skullGeometry.material.iridescence = 1.0;
        }
        let geometries = [];
        switch (this.sceneName) {
            case "mixed":
                geometries = [virusGeometry, skullGeometry, sphereGeometry, ropeGeometry, ropeGeometry, ropeGeometry, ropeGeometry, ropeGeometry, ropeGeometry, ropeGeometry];
                break;
            case "spheres":
                geometries = [sphereGeometry];
                break;
            case "skulls":
                geometries = [skullGeometry];
                break;
            case "ropes":
                geometries = [ropeGeometry];
                break;
            case "longropes":
                geometries = [longRopeGeometry];
                break;
        }

        this.softbodies = [];
        for (let i=0; i<this.softbodyCount; i++) {
            //const geometries = [sphereGeometry];
            const softbody = this.physics.addInstance(geometries[i % geometries.length]); //i % 4 === 0 ? skullGeometry : virusGeometry);
            this.softbodies.push(softbody);
            await progressCallback(0.51 + (0.3 * i / this.softbodyCount));
        }

        this.collisionGeometry = new CollisionGeometry(this.physics);
        await this.collisionGeometry.createGeometry();
        this.scene.add(this.collisionGeometry.object);

        await this.physics.bake();
        await progressCallback(0.9);

        this.tetVisualizer = new TetVisualizer(this.physics);
        this.tetVisualizer.object.visible = false;
        this.scene.add(this.tetVisualizer.object);
    }

    clear() {
        this.lights.dispose();
        this.physics.dispose();
        this.tetVisualizer.dispose();
        this.collisionGeometry.dispose();
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

        const { wireframe, bodies, scene } = conf;

        if (this.sceneName !== scene) {
            this.clear();
            this.sceneName = scene;
            await this.setupScene(() => {});
        }

        if (wireframe !== this.wireframe) {
            this.wireframe = wireframe;
            this.physics.object.visible = !wireframe;
            this.tetVisualizer.object.visible = wireframe;
        }

        this.controls.update(delta);

        this.lastSoftbody += delta;
        if (this.lastSoftbody > 0.15) {
            const nextSoftbody = this.softbodies.find((sb, index) => (index < bodies && sb.outOfSight));
            if (nextSoftbody) {
                this.lastSoftbody = Math.random() * -0.0;
                await nextSoftbody.reset();
            }
        }
        this.lights.update(elapsed);
        await this.physics.update(delta, elapsed);

        await this.renderer.renderAsync(this.scene, this.camera);

        conf.end();
    }
}
export default App;
