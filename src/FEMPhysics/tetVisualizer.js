import * as THREE from "three/webgpu";
import {Fn, instancedArray, instanceIndex, attribute} from "three/tsl";

export class TetVisualizer {
    physics = null;
    constructor(physics) {
        this.physics = physics;
        this.vertexMaterial = new THREE.SpriteNodeMaterial();
        this.vertexMaterial.positionNode = Fn(() => {
            return this.physics.vertexBuffer.get(instanceIndex, "position");
        })();
        this.vertexObject = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), this.vertexMaterial);
        this.vertexObject.count = this.physics.vertexCount;
        this.vertexObject.frustumCulled = false;

        const tetPositionBuffer = new THREE.BufferAttribute(new Float32Array(new Array(36).fill(0)), 3, false);
        const tetIndexBuffer = new THREE.BufferAttribute(new Int32Array([0,1,0,2,0,3,1,2,1,3,2,3]), 1, false);

        this.tetMaterial = new THREE.LineBasicNodeMaterial({ color: 0x000000 });
        this.tetMaterial.positionNode = Fn( () => {
            const vertices = this.physics.tetBuffer.get(instanceIndex, "vertexIds");
            const tetIndex = attribute('vertexIndex');
            const vertexId = vertices.element(tetIndex);
            return this.physics.vertexBuffer.get(vertexId, "position");
        } )();

        const tetGeometry = new THREE.InstancedBufferGeometry();
        tetGeometry.setAttribute("position", tetPositionBuffer);
        tetGeometry.setAttribute("vertexIndex", tetIndexBuffer);
        tetGeometry.instanceCount = this.physics.tetCount;

        this.tetObject = new THREE.Line(tetGeometry, this.tetMaterial);
        this.tetObject.frustumCulled = false;

        this.object = new THREE.Object3D();
        this.object.add(this.vertexObject);
        this.object.add(this.tetObject);
    }
}