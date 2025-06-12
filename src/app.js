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
    vec3, instanceIndex,
    mx_hsvtorgb
} from "three/tsl";
import {FEMPhysics} from "./FEMPhysics/FEMPhysics";
import {TetVisualizer} from "./FEMPhysics/tetVisualizer";
import CollisionGeometry from "./collisionGeometry";

import virus from './geometry/virus';
import skull from './geometry/skull3';
import icosphere from './geometry/icosphereHires';

//import icosphereMsh from './geometry/icosphere_hollow.msh?raw';

import normalMapFileVirus from './geometry/textures/virus_normal.png';
import roughnessMapFileVirus from './geometry/textures/virus_roughness.jpg';
import colorMapFileSkull from './geometry/textures/skullColor.jpg';
import normalMapFileSkull from './geometry/textures/skullNormal.png';
import roughnessMapFileSkull from './geometry/textures/skullRoughness.jpg';


/*import earthColorFile from './geometry/textures/2k_earth_daymap.jpg';
import earthNormalFile from './geometry/textures/2k_earth_normal_map.png';
import earthSpecularFile from './geometry/textures/2k_earth_specular_map.png';*/

import {conf} from "./conf";
import {Info} from "./info";
//import {generateTube, loadModelWithGeo} from "./geometry/loadModel";
//import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

//const rope = generateTube(25);
//const longRope = generateTube(500);

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

    lastPositions = [];

    textures = {
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
        this.camera.position.set(-60,20,0);
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

        this.scene.environment = this.textures.hdri;
        this.scene.environmentRotation.set(0,Math.PI,0);
        this.scene.background = this.textures.hdri;
        this.scene.backgroundRotation.set(0,Math.PI,0);

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.7;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.lights = new Lights();
        this.scene.add(this.lights.object);

        this.physics = new FEMPhysics(this.renderer);
        this.scene.add(this.physics.object);


        //const ropeGeometry = this.physics.addGeometry(rope)
        //const longRopeGeometry = this.physics.addGeometry(longRope)
        const virusGeometry = this.physics.addGeometry(virus);
        const skullGeometry = this.physics.addGeometry(skull);

        /*const geometry = BufferGeometryUtils.mergeVertices(new THREE.IcosahedronGeometry(1,10));
        console.log(geometry);
        const icosphere2 = loadModelWithGeo(icosphereMsh, geometry);*/

        const sphereGeometry = this.physics.addGeometry(icosphere);




        await progressCallback(0.5)

       {
            /*const mapFiles = [earthColorFile, earthNormalFile, earthSpecularFile];
            const [ colorMap, normalMapTexture, specularMap ] = await Promise.all(mapFiles.map(f => loadTexture(f)));
            sphereGeometry.material.normalNode = normalMap(texture(normalMapTexture), vec2(3,3));
            sphereGeometry.material.roughnessNode = texture(specularMap).oneMinus();
            sphereGeometry.material.colorNode = texture(colorMap);*/
            sphereGeometry.material.metalness = 0.0;
            sphereGeometry.material.roughness = 0.1;
            sphereGeometry.material.color = new THREE.Color(1,0.9,0.9);

            //sphereGeometry.material.iridescence = 1.0;
            //sphereGeometry.material.iridescenceIor = 2.0;
            sphereGeometry.material.ior = 1.5;
            sphereGeometry.material.transmission = 0.9;
            sphereGeometry.material.thickness = 3.2;
            sphereGeometry.material.sheen = 1;
            sphereGeometry.material.sheenColor = new THREE.Color(1,0.9,0.9);

            //conf.settings.addBinding(sphereGeometry.material, "attenuationColor", { color: {type: 'float'} });
            //conf.settings.addBinding(sphereGeometry.material, "attenuationDistance", { min: 0, max: 20, step: 0.01 });
            //sphereGeometry.material.attenuationColor = new THREE.Color("#0000ff");
            //sphereGeometry.material.attenuationDistance = 2.155;
            this.sphereMaterial = sphereGeometry.material;

        }
        {
            virusGeometry.material.normalMap = this.textures.virusNormal;
            virusGeometry.material.roughnessMap = this.textures.virusRoughness;
            virusGeometry.material.metalness = 0.4;
            virusGeometry.material.iridescence = 1.0;
            virusGeometry.material.color = 0xFFAAFF;
            virusGeometry.material.normalScale = new THREE.Vector2(3,3);

            let color, colorHighlight;

            if (this.sceneName === "viruses") {
                color = mx_hsvtorgb(vec3(float(instanceIndex).mul(0.07), 0.99, 0.25 ));
                colorHighlight = mx_hsvtorgb(vec3(float(instanceIndex).mul(0.07).add(0.1), 0.99, 0.9 ));
            } else {
                color = vec3(0.25,0,0.25);
                colorHighlight = vec3(1,0,0.5);
            }

            virusGeometry.material.colorNode = color;

            const vDistance = varying(float(0), "v_distance");
            virusGeometry.material.emissiveNode = Fn(() => {
                const dp = dot(vec3(0,0,1), normalView).max(0).pow(4);
                const of = mix(0.0, 1.0, smoothstep(1.3,1.6, vDistance));
                return dp.mul(of).mul(colorHighlight);
            })();
        }
        {
            skullGeometry.material.map = this.textures.skullColor;
            skullGeometry.material.normalMap = this.textures.skullNormal;
            skullGeometry.material.roughnessMap = this.textures.skullRoughness;
            /*skullGeometry.material.metalness = 1.0;
            skullGeometry.material.iridescence = 1.0;
            skullGeometry.material.metalness = 0.0;
            skullGeometry.material.roughness = 0.1;
            skullGeometry.material.color = new THREE.Color(1,0.9,0.9);

            skullGeometry.material.iridescence = 1.0;
            skullGeometry.material.iridescenceIor = 2.0;
            skullGeometry.material.ior = 1.5;
            skullGeometry.material.transmission = 0.8;
            skullGeometry.material.thickness = 2.27;
            skullGeometry.sheen = 1;
            skullGeometry.sheenColor = new THREE.Color(1,0.9,0.9);

            //sphereGeometry.material.attenuationColor = new THREE.Color("#f6d148");
            skullGeometry.material.attenuationDistance = 0.155;*/
        }
        let geometries = [];
        switch (this.sceneName) {
            case "mixed":
                geometries = [virusGeometry, skullGeometry, sphereGeometry];
                break;
            case "spheres":
                geometries = [sphereGeometry];
                break;
            case "skulls":
                geometries = [sphereGeometry, skullGeometry];
                break;
            case "viruses":
                geometries = [virusGeometry];
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

    getRandomPositionOnSlope() {
        const px = 30 + Math.random() * 20;
        const pz = (Math.random() - 0.5) * 40;
        const py = 10 + px * 0.4 + Math.abs(pz) * 0.4 + Math.random() * 10;
        return new THREE.Vector3(px,py,pz);
    }

    getRandomPosition() {
        let found = false;
        let position = new THREE.Vector3(0,0,0);
        while (!found) {
            position = this.getRandomPositionOnSlope();
            const nearby = this.lastPositions.find(p => {
                return p.distanceTo(position) < 8;
            })
            if (!nearby) {
                found = true;
                this.lastPositions.push(position);
                if (this.lastPositions.length > 20) {
                    this.lastPositions.shift();
                }
            }
        }
        return position;
    }

    async update(delta, elapsed) {
        conf.begin();

        const { wireframe, bodies, scene, roughness, thickness, transmission } = conf;

        this.sphereMaterial.roughness = roughness;
        this.sphereMaterial.thickness = thickness;
        this.sphereMaterial.transmission = transmission;

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

        const camZ = this.camera.position.x;
        const minY = camZ * (1/5);
        const angle = Math.atan2(this.camera.position.length(), minY);
        this.controls.maxPolarAngle = angle - 0.2;
        this.controls.update(delta);

        this.lastSoftbody += delta;
        if (this.lastSoftbody > 0.15) {
            const nextSoftbody = this.softbodies.find((sb, index) => (index < bodies && sb.outOfSight));
            if (nextSoftbody) {
                this.lastSoftbody = Math.random() * -0.2;
                const position = this.getRandomPosition();
                await nextSoftbody.reset(position);
            }
        }
        this.lights.update(elapsed);
        await this.physics.update(delta, elapsed);

        await this.renderer.renderAsync(this.scene, this.camera);

        conf.end();
    }
}
export default App;
