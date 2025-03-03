import * as THREE from "three/webgpu";
import virus from './geometry/virus';
//import virusModel from 'bundle-text:./geometry/virus_hollow75.msh';
//import virusObj from 'bundle-text:./geometry/virus.obj';
import colorMapFile from './geometry/textures/virus_baseColor.png';
import normalMapFile from './geometry/textures/virus_normal.png';
import roughnessMapFile from './geometry/textures/virus_roughness.png';
import metallicMapFile from './geometry/textures/virus_metallic.png';


import {
    attribute, cross, dot,
    float,
    Fn,
    instancedArray,
    instanceIndex,
    Loop, mix, mul, normalize, normalView, positionLocal, smoothstep,
    transformNormalToView,
    varying,
    vec3, vec4
} from "three/tsl";
import {loadModel, processObj} from "./geometry/loadModel";

const Rotate = /*#__PURE__*/ Fn( ( [ pos_immutable, quat_immutable ] ) => {
    const quat = vec4( quat_immutable ).toVar();
    const pos = vec3( pos_immutable ).toVar();

    return pos.add( mul( 2.0, cross( quat.xyz, cross( quat.xyz, pos ).add( quat.w.mul( pos ) ) ) ) );
} ).setLayout( {
    name: 'Rotate',
    type: 'vec3',
    inputs: [
        { name: 'pos', type: 'vec3' },
        { name: 'quat', type: 'vec4' }
    ]
} );
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


export class SoftbodyModel {
    physics = null;
    vertices = [];
    tets = [];
    age = 0;
    outOfSight = false;
    constructor(physics) {
        this.physics = physics;

        this.id = this.physics.addObject(this);

        //const { tetVerts, tetIds } = Cube;
        const model = virus; // loadModel(virusModel, virusObj);

        this.createTetrahedralGeometry(model);
        this.createGeometry(model);

        //console.log(skull);
        //console.log(tetVerts.map(v=>Math.round(v*10000)/10000));


        this.object = new THREE.Object3D();

        //this.createGeometry(virusObj);
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

    createGeometry(model) {
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

        this.geometry = geometry;
    }

    createMesh() {
        const object = new THREE.Mesh(this.geometry, SoftbodyModel.material);
        object.frustumCulled = false;
        object.castShadow = true;
        this.object.add(object);
        this.object.visible = false;
    }

/*
    createImplicitGeometry() {
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
        const triangleArray = new Uint32Array(triangles.length * 2 * 3);
        let trianglePtr = 0;

        surfaceVertices.forEach((vertex,index) => {
            vertexIdArray[index] = vertex.id;
            vertex.geometryVertexId = index;
            trianglePtrArray[index * 2 + 0] = trianglePtr;
            trianglePtrArray[index * 2 + 1] = vertex.triangles.length;
            vertex.triangles.forEach(([v1,v2]) => {
                triangleArray[trianglePtr * 2 + 0] = v1.id;
                triangleArray[trianglePtr * 2 + 1] = v2.id;
                trianglePtr++;
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

        this.implicitTriangleBuffer = instancedArray(new Uint32Array(triangleArray), 'uvec2').label("triangles");
        this.createImplicitMaterial();

        const mesh = new THREE.Mesh(geometry, this.implicitMaterial);
        mesh.castShadow = true;
        mesh.frustumCulled = false;
        this.object.add(mesh);
        //const mesh = new THREE.Mesh(geometry, this.material);
        //mesh.frustumCulled = false;
        //this.object.add(mesh);


    }

    createImplicitMaterial() {
        this.implicitMaterial = new THREE.MeshSSSNodeMaterial({
            metalness: 0.95,
            roughness: 0.109385,
            color: 0xFF00FF,
        });
        this.implicitMaterial.thicknessColorNode = vec3(1,0,1).mul(0.5);

        const vNormal = varying(vec3(0), "v_normalView");
        this.implicitMaterial.positionNode = Fn(() => {
            const vertexId = attribute('vertexId');
            const position = this.physics.positionBuffer.element(vertexId).xyz.toVar();

            const trianglePtr = attribute('trianglePtr');
            const ptrStart = trianglePtr.x.toVar();
            const ptrEnd = ptrStart.add(trianglePtr.y).toVar();
            const normal = vec3().toVar();
            Loop({ start: ptrStart, end: ptrEnd,  type: 'uint', condition: '<' }, ({ i })=>{
                const triangle = this.implicitTriangleBuffer.element(i);
                const v1 = this.physics.positionBuffer.element(triangle.x).xyz;
                const v2 = this.physics.positionBuffer.element(triangle.y).xyz;
                const tangent = v1.sub(position);
                const bitangent = v2.sub(position);
                normal.addAssign(cross(tangent,bitangent));
            });
            vNormal.assign(transformNormalToView(normal));

            return position;
        })();
        this.implicitMaterial.normalNode = vNormal.normalize();
    }*/

    async reset() {
        const scale = 1.0 + Math.random() * 2;
        const position = new THREE.Vector3((Math.random() - 0.5) * 40, 3 + 2 * scale + Math.random() * 0.5, (Math.random() - 0.5) * 0.9);
        position.z -= 5 * 5;
        position.y += 5 * 3;
        const velocity = new THREE.Vector3(0,-0.005,0.03);
        await this.physics.resetObject(this.id, position, scale, velocity);
        this.age = 0;
        this.object.visible = true;
    }

    async update(interval) {
        this.age += interval;
        const position = this.physics.getPosition(this.id);
        this.outOfSight = (!this.object.visible || position.z > 60);
    }

    async bake() {
        //this.createImplicitGeometry();
        this.createMesh();

    }

    static async createMaterial(physics) {
        const material = new THREE.MeshPhysicalNodeMaterial({
            //map: SoftbodyModel.colorMap,
            color: 0x000000,
            roughnessMap: SoftbodyModel.roughnessMap,
            metalnessMap: SoftbodyModel.metallicMap,
            normalMap: SoftbodyModel.normalMap,
            normalScale: new THREE.Vector2(3,3),
            iridescence: 1.0,
            //transparent: true,
            //opacity:0.9,
        });

        const vNormal = varying(vec3(0), "v_normalView");
        const vDistance = varying(float(0), "v_distance");
        material.positionNode = Fn(() => {
            const tetId = attribute("tetId");

            const vertexIds = attribute("vertexIds");
            const baryCoords = attribute("tetBaryCoords");
            const v0 = physics.positionBuffer.element(vertexIds.x).xyz.toVar();
            const v1 = physics.positionBuffer.element(vertexIds.y).xyz.toVar();
            const v2 = physics.positionBuffer.element(vertexIds.z).xyz.toVar();
            const v3 = physics.positionBuffer.element(vertexIds.w).xyz.toVar();
            const quat = physics.quatsBuffer.element(tetId);

            const normal = Rotate(attribute("normal"), quat);
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
        material.colorNode = Fn(() => {
            return vec3(0.5,0,0.5).mul(0.05);
        })();
        material.emissiveNode = Fn(() => {
            const dp = dot(vec3(0,0,1), normalView).max(0).pow(4);
            const color = vec3(1,0,0.5);
            const of = mix(0.0, 1.0, smoothstep(1.3,1.6, vDistance));
            return dp.mul(of).mul(color);
        })();

        SoftbodyModel.material = material;
    }

    static async loadTextures() {
        SoftbodyModel.colorMap = await loadTexture(colorMapFile);
        SoftbodyModel.normalMap = await loadTexture(normalMapFile);
        SoftbodyModel.roughnessMap = await loadTexture(roughnessMapFile);
        SoftbodyModel.metallicMap = await loadTexture(metallicMapFile);
    }
}
