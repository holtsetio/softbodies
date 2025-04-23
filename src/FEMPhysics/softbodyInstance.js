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

    async reset() {
        const scale = 3; //2.0 + Math.random() * 1;

        const radius = 50;
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        const x = radius * Math.sin(theta) * Math.cos(phi);
        const y = radius * Math.cos(theta);
        const z = radius * Math.sin(theta) * Math.sin(phi);


        const position = new THREE.Vector3(x,y,z);
        const velocity = new THREE.Vector3(0,-0.005,0.03);
        await this.physics.resetObject(this.id, position, scale, velocity);
        this.age = 0;
        //this.object.visible = true;
        this.spawned = true;
        this.outOfSight = false;
    }

    async initPos() {
        const scale = 3.0;
        const position = new THREE.Vector3((Math.random() - 0.5) * 4000 + 4000, 4000, (Math.random() - 0.5) * 4000);
        const velocity = new THREE.Vector3(0,-0.005,0.00);
        await this.physics.resetObject(this.id, position, scale, velocity);
        this.age = 0;
        //this.object.visible = true;
        this.spawned = false;
    }

    async update(interval) {
        this.age += interval;
        const position = this.physics.getPosition(this.id);
        this.outOfSight = (!this.spawned || position.z > 70);
    }
};