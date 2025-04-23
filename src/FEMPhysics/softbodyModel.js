import * as THREE from "three/webgpu";
import {
    attribute,
    cross,
    float,
    Fn,
    mul,
    transformNormalToView,
    varying,
    vec3,
    vec4
} from "three/tsl";
import {rotateByQuat} from "./math.js";

export class SoftbodyModel {
    physics = null;
    vertices = [];
    tets = [];
    age = 0;
    spawned = false;
    outOfSight = false;
    constructor(physics, geometry) {
        this.physics = physics;

        this.id = this.physics._addObject(this);

        this.createTetrahedralGeometry(geometry.model);
        this.createGeometry(geometry.model, geometry.material);
    }

    createTetrahedralGeometry(model) {
        const { tetVerts, tetIds } = model;
        for (let i=0; i < tetVerts.length; i += 3) {
            const x = tetVerts[i];
            const y = tetVerts[i+1];
            const z = tetVerts[i+2];
            const vertex = this.physics.addVertex(this.id,x,y,z);
            this.vertices.push(vertex);
        }
        for (let i=0; i < tetIds.length; i += 4) {
            const a = this.vertices[tetIds[i]];
            const b = this.vertices[tetIds[i+1]];
            const c = this.vertices[tetIds[i+2]];
            const d = this.vertices[tetIds[i+3]];
            this.tets.push(this.physics.addTet(this.id,a,b,c,d));
        }
    }

    createGeometry(model, material) {
        const { attachedTets, baryCoords, positions, normals, uvs, indices } = model;
        const vertexCount = attachedTets.length;
        const positionArray = new Float32Array(positions);
        const normalArray = new Float32Array(normals);
        const uvArray = new Float32Array(uvs);
        const tetIdArray = new Uint32Array(vertexCount);
        const vertexIdArray = new Uint32Array(vertexCount * 4);
        const tetBaryCoordsArray = new Float32Array(baryCoords);
        const objectIdArray = new Uint32Array([this.id]);

        for (let i=0; i<vertexCount; i++) {
            const tet = this.tets[attachedTets[i]];
            tetIdArray[i] = tet.id;
            vertexIdArray[i*4+0] = tet.v0.id;
            vertexIdArray[i*4+1] = tet.v1.id;
            vertexIdArray[i*4+2] = tet.v2.id;
            vertexIdArray[i*4+3] = tet.v3.id;
        }

        const positionBuffer = new THREE.BufferAttribute(positionArray, 3, false);
        const normalBuffer = new THREE.BufferAttribute(normalArray, 3, false);
        const uvBuffer = new THREE.BufferAttribute(uvArray, 2, false);
        const tetIdBuffer = new THREE.BufferAttribute(tetIdArray, 1, false);
        const vertexIdsBuffer = new THREE.BufferAttribute(vertexIdArray, 4, false);
        const tetBaryCoordsBuffer = new THREE.BufferAttribute(tetBaryCoordsArray, 3, false);
        const objectIdBuffer = new THREE.InstancedBufferAttribute(objectIdArray, 1, false);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", positionBuffer);
        geometry.setAttribute("normal", normalBuffer);
        geometry.setAttribute("uv", uvBuffer);
        geometry.setAttribute("tetId", tetIdBuffer);
        geometry.setAttribute("vertexIds", vertexIdsBuffer);
        geometry.setAttribute("tetBaryCoords", tetBaryCoordsBuffer);
        geometry.setAttribute("objectId", objectIdBuffer);
        geometry.setIndex(indices);

        const object = new THREE.Mesh(geometry, material);
        object.frustumCulled = false;
        object.castShadow = true;
        object.receiveShadow = true;
        object.visible = false;
        this.object = object;
    }

    createMesh() {
    }

    async reset() {
        const scale = 3; //2.0 + Math.random() * 1;

        const radius = 50;
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        const x = radius * Math.sin(theta) * Math.cos(phi);
        const y = radius * Math.cos(theta);
        const z = radius * Math.sin(theta) * Math.sin(phi);


        const position = new THREE.Vector3(x,y,z);

        //position.z -= 5 * 5;
        //position.y += 5 * 3;
        const velocity = new THREE.Vector3(0,-0.005,0.03);
        await this.physics.resetObject(this.id, position, scale, velocity);
        this.age = 0;
        this.object.visible = true;
        this.spawned = true;
        this.outOfSight = false;
    }

    async initPos() {
        const scale = 2.0 + Math.random() * 1;
        const position = new THREE.Vector3((Math.random() - 0.5) * 4000 + 4000, 4000, (Math.random() - 0.5) * 4000);
        const velocity = new THREE.Vector3(0,-0.005,0.00);
        await this.physics.resetObject(this.id, position, scale, velocity);
        this.age = 0;
        this.object.visible = true;
        this.spawned = false;
    }

    async update(interval) {
        this.age += interval;
        const position = this.physics.getPosition(this.id);
        this.outOfSight = (!this.spawned || position.z > 70);
    }

    async bake() {

    }

    static createMaterial(physics, materialClass) {
        const material = new materialClass();

        const vNormal = varying(vec3(0), "v_normalView");
        const vDistance = varying(float(0), "v_distance");
        material.positionNode = Fn(() => {
            const tetId = attribute("tetId");

            const vertexIds = attribute("vertexIds");
            const baryCoords = attribute("tetBaryCoords");
            const v0 = physics.vertexBuffer.get(vertexIds.x, "position").xyz.toVar();
            const v1 = physics.vertexBuffer.get(vertexIds.y, "position").xyz.toVar();
            const v2 = physics.vertexBuffer.get(vertexIds.z, "position").xyz.toVar();
            const v3 = physics.vertexBuffer.get(vertexIds.w, "position").xyz.toVar();
            const quat = physics.tetBuffer.get(tetId, "quat");

            const normal = rotateByQuat(attribute("normal"), quat);
            vNormal.assign(transformNormalToView(normal));
            vDistance.assign(attribute("position").length());

            const a = v1.sub(v0).mul(baryCoords.x);
            const b = v2.sub(v0).mul(baryCoords.y);
            const c = v3.sub(v0).mul(baryCoords.z);
            const position = a.add(b).add(c).add(v0).toVar();

            const objectId = attribute("objectId");
            const positionInitial = attribute("position");
            const scale = physics.uniforms.scales.element(objectId).toVar();

            position.subAssign(positionInitial.mul(scale.oneMinus()));
            return position;
        })();

        return material;
    }
}
