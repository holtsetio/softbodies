import * as THREE from "three/webgpu";
import * as Dragon from './geometry/dragon';
import * as Icosphere from './geometry/icosphere';
import * as Cube from './geometry/cube';
import * as Torus from './geometry/torus';
import {
    attribute, cross,
    float,
    Fn,
    instancedArray,
    instanceIndex,
    Loop, normalize,
    transformNormalToView,
    varying,
    vec3
} from "three/tsl";

export class SoftbodyModel {
    physics = null;
    constructor(physics) {
        this.physics = physics;
        console.log(Icosphere);

        const { tetVerts, tetIds } = Icosphere;
        for (let i=0; i < tetVerts.length; i += 3) {
            const x = tetVerts[i]*0.2;
            const y = tetVerts[i+1]*0.2;
            const z = tetVerts[i+2]*0.2;
            this.physics.addVertex(x,y,z);
        }

        for (let i=0; i < tetIds.length; i += 4) {
            const a = tetIds[i]-1;
            const b = tetIds[i+1]-1;
            const c = tetIds[i+2]-1;
            const d = tetIds[i+3]-1;
            this.physics.addTet(a,b,c,d);
        }

        /*const verticesBuffer = instancedArray(Dragon.dragonTetVerts, 'vec3');
        this.material = new THREE.SpriteNodeMaterial();
        this.material.positionNode = Fn(() => {
            return verticesBuffer.element(instanceIndex);
        })();
        this.object = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), this.material);
        this.object.count = verts.length / 3;
        this.object.frustumCulled = false;*/
    }

    createMaterial(triangleBuffer) {
        this.material = new THREE.MeshSSSNodeMaterial({
            metalness: 0.05,
            roughness: 0.9385,
            color: 0xFF00FF,
        });
        this.material.thicknessColorNode = vec3(1,0,1).mul(0.5);

        const vNormal = varying(vec3(0), "v_normalView");
        this.material.positionNode = Fn(() => {
            const vertexId = attribute('vertexId');
            const position = this.physics.vertexBuffer.element(vertexId).xyz.toVar();

            const trianglePtr = attribute('trianglePtr');
            const ptrStart = trianglePtr.x.toVar();
            const ptrEnd = ptrStart.add(trianglePtr.y).toVar();
            const normal = vec3().toVar();
            Loop({ start: ptrStart, end: ptrEnd,  type: 'uint', condition: '<' }, ({ i })=>{
                const triangle = triangleBuffer.element(i);
                const v1 = this.physics.vertexBuffer.element(triangle.x).xyz;
                const v2 = this.physics.vertexBuffer.element(triangle.y).xyz;
                const tangent = v1.sub(position);
                const bitangent = v2.sub(position);
                normal.addAssign(cross(tangent,bitangent));
            });
            vNormal.assign(transformNormalToView(normal));

            return position;
        })();
        this.material.normalNode = vNormal.normalize();
    }

    createGeometry() {
        const triangleDict = {};
        const triangles = [];
        const addTriangle = (v0id, v1id, v2id, v3id) => {
            const id = [v0id, v1id, v2id].sort((a,b) => { return a - b; }).join('.');
            if (triangleDict[id]) {
                delete triangleDict[id];
            } else {
                triangleDict[id] = [v0id, v1id, v2id, v3id];
            }
        };

        for (let i=0; i<this.physics.tetCount; i++) {
            const v0id = this.physics.tets[i*4+0];
            const v1id = this.physics.tets[i*4+1];
            const v2id = this.physics.tets[i*4+2];
            const v3id = this.physics.tets[i*4+3];
            addTriangle(v0id, v1id, v2id, v3id);
            addTriangle(v1id, v2id, v3id, v0id);
            addTriangle(v2id, v3id, v0id, v1id);
            addTriangle(v3id, v0id, v1id, v2id);
        }

        const tangent = new THREE.Vector3();
        const bitangent = new THREE.Vector3();
        const toInner = new THREE.Vector3();

        Object.keys(triangleDict).forEach(key => {
            const triangle = triangleDict[key];
            let [v0id, v1id, v2id, v3id] = triangle;
            let v0 = this.physics.vertices[v0id];
            let v1 = this.physics.vertices[v1id];
            let v2 = this.physics.vertices[v2id];
            let v3 = this.physics.vertices[v3id];
            tangent.copy(v0).sub(v1);
            bitangent.copy(v0).sub(v2);
            toInner.copy(v3).sub(v0);
            if (tangent.cross(bitangent).dot(toInner) > 0) {
                [v1id, v2id] = [v2id, v1id];
                [v1, v2] = [v2, v1];
            }
            v0.isSurface = true;
            v0.triangles.push([v1id,v2id]);
            v1.isSurface = true;
            v1.triangles.push([v2id,v0id]);
            v2.isSurface = true;
            v2.triangles.push([v0id,v1id]);
            triangles.push([v0,v1,v2]);
        });

        let geometryVertexCount = 0;
        const vertexIdArray = [];
        const indices = [];

        for (let i=0; i<this.physics.vertexCount; i++) {
            const vertex = this.physics.vertices[i];
            if (!vertex.isSurface) { continue; }
            vertexIdArray.push(i);
            vertex.geometryVertexId = geometryVertexCount;
            geometryVertexCount++;
        }

        const trianglePtrArray = new Uint32Array(vertexIdArray.length * 2); // x: ptr, y: length
        const triangleArray = new Uint32Array(triangles.length * 2 * 3);
        let trianglePtr = 0;
        for (let i=0; i < vertexIdArray.length; i++) {
            const vertex = this.physics.vertices[vertexIdArray[i]];
            trianglePtrArray[i * 2 + 0] = trianglePtr;
            trianglePtrArray[i * 2 + 1] = vertex.triangles.length;
            vertex.triangles.forEach(([v1,v2]) => {
                triangleArray[trianglePtr * 2 + 0] = v1;
                triangleArray[trianglePtr * 2 + 1] = v2;
                trianglePtr++;
            });
        }

        triangles.forEach(triangle => {
           const [v0,v1,v2] = triangle;
           indices.push(v0.geometryVertexId);
           indices.push(v1.geometryVertexId);
           indices.push(v2.geometryVertexId);
        });
        console.log(trianglePtrArray);
        console.log(triangleArray);

        const triangleBuffer = instancedArray(triangleArray, 'uvec2');
        this.createMaterial(triangleBuffer);

        const positionBuffer = new THREE.BufferAttribute(new Float32Array(vertexIdArray.length * 3), 3, false);
        const vertexIdBuffer = new THREE.BufferAttribute(new Uint32Array(vertexIdArray), 1, false);
        const trianglePtrBuffer = new THREE.BufferAttribute(trianglePtrArray, 2, false);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', positionBuffer);
        geometry.setAttribute('vertexId', vertexIdBuffer);
        geometry.setAttribute('trianglePtr', trianglePtrBuffer);
        geometry.setIndex(indices);
        this.object = new THREE.Mesh(geometry, this.material);
        this.object.frustumCulled = false;

        console.log(this.physics.vertices);
    }

    bake() {

        this.createGeometry();
    }

}