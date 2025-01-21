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
    vertices = [];
    tets = [];
    constructor(physics, offset = new THREE.Vector3()) {
        this.physics = physics;
        console.log(Icosphere);

        const { tetVerts, tetIds } = Icosphere;

        for (let i=0; i < tetVerts.length; i += 3) {
            const x = tetVerts[i]*0.2 + offset.x;
            const y = tetVerts[i+1]*0.2 + offset.y;
            const z = tetVerts[i+2]*0.2 + offset.z;
            this.vertices.push(this.physics.addVertex(x,y,z));
        }

        for (let i=0; i < tetIds.length; i += 4) {
            const a = this.vertices[tetIds[i]-1];
            const b = this.vertices[tetIds[i+1]-1];
            const c = this.vertices[tetIds[i+2]-1];
            const d = this.vertices[tetIds[i+3]-1];
            this.tets.push(this.physics.addTet(a,b,c,d));
        }
        this.object = new THREE.Object3D();

        this.physics.addObject(this);
        this.createGeometry();
        SoftbodyModel.addObject(this);
    }

    createGeometry() {
        const triangleDict = {};
        const triangles = [];
        const addTriangle = (v0, v1, v2, v3) => {
            const id = [v0.id, v1.id, v2.id].sort((a,b) => { return a - b; }).join('.');
            if (triangleDict[id]) {
                delete triangleDict[id];
            } else {
                triangleDict[id] = [v0, v1, v2, v3];
            }
        };

        this.tets.forEach((tet) => {
            const { v0,v1,v2,v3 } = tet;
            addTriangle(v0, v1, v2, v3);
            addTriangle(v1, v2, v3, v0);
            addTriangle(v2, v3, v0, v1);
            addTriangle(v3, v0, v1, v2);
        });

        const tangent = new THREE.Vector3();
        const bitangent = new THREE.Vector3();
        const toInner = new THREE.Vector3();

        Object.keys(triangleDict).forEach(key => {
            const triangle = triangleDict[key];
            let [v0, v1, v2, v3] = triangle;
            tangent.copy(v0).sub(v1);
            bitangent.copy(v0).sub(v2);
            toInner.copy(v3).sub(v0);
            if (tangent.cross(bitangent).dot(toInner) > 0) {
                [v1, v2] = [v2, v1];
            }
            v0.isSurface = true;
            v0.triangles.push([v1,v2]);
            v1.isSurface = true;
            v1.triangles.push([v2,v0]);
            v2.isSurface = true;
            v2.triangles.push([v0,v1]);
            triangles.push([v0,v1,v2]);
        });

        const surfaceVertices = this.vertices.filter(v => v.isSurface);
        const indices = [];
        const vertexIdArray = new Uint32Array(surfaceVertices.length);
        const trianglePtrArray = new Uint32Array(surfaceVertices.length * 2); // x: ptr, y: length
        //const triangleArray = new Uint32Array(triangles.length * 2 * 3);

        surfaceVertices.forEach((vertex,index) => {
            vertexIdArray[index] = vertex.id;
            vertex.geometryVertexId = index;
            trianglePtrArray[index * 2 + 0] = SoftbodyModel.trianglePtr;
            trianglePtrArray[index * 2 + 1] = vertex.triangles.length;
            vertex.triangles.forEach(([v1,v2]) => {
                SoftbodyModel.addTriangle(v1,v2);
            });
        });

        triangles.forEach(triangle => {
           const [v0,v1,v2] = triangle;
           indices.push(v0.geometryVertexId);
           indices.push(v1.geometryVertexId);
           indices.push(v2.geometryVertexId);
        });

        //const triangleBuffer = instancedArray(triangleArray, 'uvec2');
        //this.createMaterial(triangleBuffer);

        const positionBuffer = new THREE.BufferAttribute(new Float32Array(vertexIdArray.length * 3), 3, false);
        const vertexIdBuffer = new THREE.BufferAttribute(new Uint32Array(vertexIdArray), 1, false);
        const trianglePtrBuffer = new THREE.BufferAttribute(trianglePtrArray, 2, false);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', positionBuffer);
        geometry.setAttribute('vertexId', vertexIdBuffer);
        geometry.setAttribute('trianglePtr', trianglePtrBuffer);
        geometry.setIndex(indices);
        this.geometry = geometry;
        //const mesh = new THREE.Mesh(geometry, this.material);
        //mesh.frustumCulled = false;
        //this.object.add(mesh);


    }

    static objects = [];
    static trianglePtr = 0;
    static triangleArray = [];
    static addObject(object) {
        SoftbodyModel.objects.push(object);
    }
    static addTriangle(v1,v2) {
        SoftbodyModel.triangleArray.push(v1.id, v2.id);
        SoftbodyModel.trianglePtr++;
    }
    static async bake(physics) {
        SoftbodyModel.triangleBuffer = instancedArray(new Uint32Array(SoftbodyModel.triangleArray), 'uvec2').label("triangles");
        console.log(SoftbodyModel.triangleArray);
        SoftbodyModel.createMaterial(physics);
        SoftbodyModel.objects.forEach((object) => {
            const mesh = new THREE.Mesh(object.geometry, SoftbodyModel.material);
            mesh.frustumCulled = false;
            object.object.add(mesh);
        });
    }
    static createMaterial(physics) {
        SoftbodyModel.material = new THREE.MeshSSSNodeMaterial({
            metalness: 0.95,
            roughness: 0.109385,
            color: 0xFF00FF,
        });
        SoftbodyModel.material.thicknessColorNode = vec3(1,0,1).mul(0.5);

        const vNormal = varying(vec3(0), "v_normalView");
        SoftbodyModel.material.positionNode = Fn(() => {
            const vertexId = attribute('vertexId');
            const position = physics.positionBuffer.element(vertexId).xyz.toVar();

            const trianglePtr = attribute('trianglePtr');
            const ptrStart = trianglePtr.x.toVar();
            const ptrEnd = ptrStart.add(trianglePtr.y).toVar();
            const normal = vec3().toVar();
            Loop({ start: ptrStart, end: ptrEnd,  type: 'uint', condition: '<' }, ({ i })=>{
                const triangle = SoftbodyModel.triangleBuffer.element(i);
                const v1 = physics.positionBuffer.element(triangle.x).xyz;
                const v2 = physics.positionBuffer.element(triangle.y).xyz;
                const tangent = v1.sub(position);
                const bitangent = v2.sub(position);
                normal.addAssign(cross(tangent,bitangent));
            });
            vNormal.assign(transformNormalToView(normal));

            return position;
        })();
        SoftbodyModel.material.normalNode = vNormal.normalize();
    }

    async bake() {

    }

}