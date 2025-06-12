import * as THREE from "three/webgpu";

export class SoftbodyInstance {
    physics = null;
    vertices = [];
    tets = [];
    age = 0;
    spawned = false;
    outOfSight = false;

    constructor(physics, geometry) {
        this.physics = physics;
        this.geometry = geometry;

        const params = this.physics._addObject(this);

        this.id = params.id;
        this.tetOffset = params.tetStart;
        this.vertexOffset = params.vertexStart;

        this.createTetrahedralGeometry();
    }

    createTetrahedralGeometry() {
        const { tetVerts, tetIds } = this.geometry.model;
        for (let i=0; i < tetVerts.length; i += 3) {
            const x = tetVerts[i]*3;
            const y = tetVerts[i+1]*3;
            const z = tetVerts[i+2]*3;
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

    async reset(position) {
        const scale = new THREE.Vector3(1,1,1);
        const quaternion = new THREE.Quaternion().random();
        //if (!this.geometry.material.iridescence) { quaternion.random(); }

        //const velocity = new THREE.Vector3(0,-0.005,0.03);
        const velocity = new THREE.Vector3(0,0, 0);
        await this.physics.resetObject(this.id, position, quaternion, scale, velocity);
        this.age = 0;
        //this.object.visible = true;
        this.spawned = true;
        this.outOfSight = false;
        this.geometry.updateCount();
    }

    async update(interval) {
        this.age += interval;
        const position = this.physics.getPosition(this.id);
        this.outOfSight = (!this.spawned || position.x < -70);
    }
};