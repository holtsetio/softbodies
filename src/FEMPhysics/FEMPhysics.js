import * as THREE from "three/webgpu";
import {
    Fn,
    instancedArray,
    instanceIndex,
    float,
    uint,
    vec3,
    vec2,
    sin,
    vec4,
    cross,
    mul,
    mat3,
    int,
    dot,
    abs,
    div,
    length,
    If,
    Loop,
    Break,
    normalize, Return, uniform, select, time, mix, min, uniformArray, ivec3, atomicAdd, atomicStore, atomicFunc, uvec3, struct
} from "three/tsl";
import {SoftbodyGeometry} from "./softbodyGeometry.js";
import {conf} from "../conf";
import {StructuredArray} from "./structuredArray.js";
import { murmurHash13, rotateByQuat, quat_conj, quat_mult, extractRotation } from "./math.js";

export class FEMPhysics {
    vertices = [];

    tets = [];

    geometries = [];

    objects = [];

    objectData = [];

    vertexCount = 0;

    tetCount = 0;

    density = 1000;

    kernels = {};

    uniforms = {};

    time = 0;

    frameNum = 0;

    timeSinceLastStep = 0;

    colliders = [];

    objectCount = 0;

    constructor(renderer) {
        this.renderer = renderer;
        this.object = new THREE.Object3D();
    }

    addVertex(objectId,x,y,z) {
        const id = this.vertexCount;
        const vertex = new THREE.Vector3(x,y,z);
        vertex.id = id;
        vertex.objectId = objectId;
        vertex.influencers = [];
        this.vertices.push(vertex);

        const objectDataElement = this.objectData[objectId];
        const distance = vertex.length();
        if (distance < objectDataElement.centerVertexDistance) {
            objectDataElement.centerVertexDistance = distance;
            objectDataElement.centerVertex = vertex;
        }

        objectDataElement.vertexCount++;
        this.vertexCount++;
        return vertex;
    }

    addTet(objectId,v0,v1,v2,v3) {
        const id = this.tetCount;
        const tet = {id,v0,v1,v2,v3,objectId};
        this.tets.push(tet);
        v0.influencers.push(id * 4 + 0);
        v1.influencers.push(id * 4 + 1);
        v2.influencers.push(id * 4 + 2);
        v3.influencers.push(id * 4 + 3);
        this.objectData[objectId].tetCount++;
        this.tetCount++;
        return tet;
    }

    _addObject(object) {
        const id = this.objects.length;
        this.objects.push(object);

        const params = {
            id,
            centerVertexDistance: 1e9,
            centerVertex: null,
            tetStart: this.tetCount,
            tetCount: 0,
            vertexStart: this.vertexCount,
            vertexCount: 0,
            position: new THREE.Vector3(),
        };

        this.objectData.push(params);
        return params;
    }

    addGeometry(model, materialClass = THREE.MeshPhysicalNodeMaterial) {
        const geometry = new SoftbodyGeometry(this, model, materialClass);
        this.geometries.push(geometry);
        return geometry;
    }

    addInstance(geometry) {
        return geometry.addInstance();
    }

    addCollider(collider) {
        this.colliders.push(collider);
    }

    getPosition(objectId) {
        return this.objectData[objectId].position;
    }

    async bake() {
        console.log(this.vertexCount + " vertices");
        console.log(this.tetCount + " tetrahedrons");

        // ################
        //  CREATE BUFFERS
        // ################

        const tetStruct = {
            restVolume: "float",
            radius: "float",
            objectId: "uint",
            nextTet: "int",
            quat: "vec4",
            initialPosition: "vec3",
            centroid: "vec3",
            vertexIds: "uvec4",
        };
        const tetBuffer = new StructuredArray(tetStruct, this.tetCount, "tets");
        this.tetBuffer = tetBuffer;

        const restposeStruct = {
            position: "vec3",
            restVolume: "float",
        };
        const restPosesBuffer = new StructuredArray(restposeStruct, this.tetCount * 4, "restPoses");
        this.restPosesBuffer = restPosesBuffer;

        let maxRadius = 0;
        this.tets.forEach((tet,index) => {
            const { v0, v1, v2, v3 } = tet;
            const center = v0.clone().add(v1).add(v2).add(v3).multiplyScalar(0.25);
            const a = v1.clone().sub(v0);
            const b = v2.clone().sub(v0);
            const c = v3.clone().sub(v0);
            const V = Math.abs(a.cross(b).dot(c)) / 6;
            const radius = (Math.pow((3/4) * V / Math.PI, 1/3));
            maxRadius = Math.max(maxRadius, radius);
            const vs = [v0, v1, v2, v3];
            vs.forEach((vertex,subindex) => {
                restPosesBuffer.set(index*4 + subindex, "position", vertex);
                restPosesBuffer.set(index*4 + subindex, "restVolume", V);
            });

            tetBuffer.set(index, "initialPosition", center);
            tetBuffer.set(index, "vertexIds", [v0.id,v1.id,v2.id,v3.id]);
            tetBuffer.set(index, "restVolume", V);
            tetBuffer.set(index, "quat", [0,0,0,1]);
            tetBuffer.set(index, "objectId", tet.objectId);
            tetBuffer.set(index, "radius", radius);
        });
        console.log("maxRadius", maxRadius);


        const vertexStruct = {
            objectId: "uint",
            influencerPtr: "uint",
            influencerCount: "uint",
            initialPosition: "vec3",
            position: "vec3",
            prevPosition: "vec3",
        };
        const vertexBuffer = new StructuredArray(vertexStruct, this.vertexCount, "vertices");
        this.vertexBuffer = vertexBuffer;

        const influencerArray = new Uint32Array(this.tetCount * 4);
        let influencerPtr = 0;
        this.vertices.forEach((vertex, index) => {
            vertexBuffer.set(index, "initialPosition", vertex);
            //vertexBuffer.set(index, "position", vertex);
            vertexBuffer.set(index, "prevPosition", vertex);
            vertexBuffer.set(index, "influencerPtr", influencerPtr);
            vertexBuffer.set(index, "influencerCount", vertex.influencers.length);
            vertexBuffer.set(index, "objectId", vertex.objectId);

            vertex.influencers.forEach(influencer => {
                influencerArray[influencerPtr] = influencer;
                influencerPtr++;
            });
        });

        const objectStruct = {
            size: "float",
            centerVertex: "uint",
        }
        const objectBuffer = new StructuredArray(objectStruct, this.objects.length, "objects");
        this.objectBuffer = objectBuffer;
        this.objectData.forEach((objectData, index) => {
            objectBuffer.set(index, "size", 0.0);
            objectBuffer.set(index, "centerVertex", objectData.centerVertex.id);
        });


        this.influencerBuffer = instancedArray(influencerArray, 'uint');

        const hashMapSize = 1048573; //
        const hashingCellSize = maxRadius * 2; //0.36
        this.hashBuffer = instancedArray(hashMapSize, "int").toAtomic();

        // #################
        //  CREATE UNIFORMS
        // #################

        this.uniforms.vertexCount = uniform(this.vertexCount, "int");
        this.uniforms.tetCount = uniform(this.tetCount, "int");
        this.uniforms.time = uniform(0, "float");
        this.uniforms.dt = uniform(1, "float");
        this.uniforms.gravity = uniform(new THREE.Vector3(0,-9.81*2,0), "vec3");
        //this.uniforms.scales = uniformArray(new Array(this.objectData.length).fill(0), "float");
        this.uniforms.rotationRefinementSteps = uniform(2, "int");
        conf.settings.addBinding(this.uniforms.rotationRefinementSteps, "value", { min: 1, max: 9, step: 1 });


        // ################
        //  CREATE KERNELS
        // ################

        this.kernels.clearHashMap = Fn(() => {
            this.hashBuffer.setAtomic(false);
            /*If(instanceIndex.greaterThanEqual(uint(hashMapSize)), () => {
                Return();
            });*/
            this.hashBuffer.element(instanceIndex).assign(-1);
        })().compute(hashMapSize);
        console.time("clearHashMap");
        await this.renderer.computeAsync(this.kernels.clearHashMap); //call once to compile
        console.timeEnd("clearHashMap");


        this.kernels.solveElemPass = Fn(() => {
            this.hashBuffer.setAtomic(true);
            If(instanceIndex.greaterThanEqual(this.uniforms.tetCount), () => {
                Return();
            });
            const objectId = tetBuffer.get(instanceIndex, "objectId");
            const size = objectBuffer.get(objectId, "size");
            If(size.lessThan(0.0001), () => {
                Return();
            });

            // Gather this tetrahedron's 4 vertex positions
            const vertexIds = tetBuffer.get(instanceIndex, "vertexIds").toVar();
            const pos0 = vertexBuffer.get(vertexIds.x, "position").toVar();
            const pos1 = vertexBuffer.get(vertexIds.y, "position").toVar();
            const pos2 = vertexBuffer.get(vertexIds.z, "position").toVar();
            const pos3 = vertexBuffer.get(vertexIds.w, "position").toVar();

            // The Reference Rest Pose Positions
            // These are the same as the resting pose, but they're already pre-rotated
            // to a good approximation of the current pose
            const ref0 = restPosesBuffer.get(instanceIndex.mul(4), "position").toVar();
            const ref1 = restPosesBuffer.get(instanceIndex.mul(4).add(1), "position").toVar();
            const ref2 = restPosesBuffer.get(instanceIndex.mul(4).add(2), "position").toVar();
            const ref3 = restPosesBuffer.get(instanceIndex.mul(4).add(3), "position").toVar();

            // Get the centroids
            const curCentroid = pos0.add(pos1).add(pos2).add(pos3).mul(0.25).toVar();
            const lastRestCentroid = ref0.add(ref1).add(ref2).add(ref3).mul(0.25).toVar();

            // Center the Deformed Tetrahedron
            pos0.subAssign(curCentroid);
            pos1.subAssign(curCentroid);
            pos2.subAssign(curCentroid);
            pos3.subAssign(curCentroid);

            // Center the Undeformed Tetrahedron
            ref0.subAssign(lastRestCentroid);
            ref1.subAssign(lastRestCentroid);
            ref2.subAssign(lastRestCentroid);
            ref3.subAssign(lastRestCentroid);

            // Find the rotational offset between the two and rotate the undeformed tetrahedron by it
            const covariance = mat3(0,0,0,0,0,0,0,0,0).toVar();
            covariance.element(0).xyz.addAssign(ref0.xxx.mul(pos0));
            covariance.element(1).xyz.addAssign(ref0.yyy.mul(pos0));
            covariance.element(2).xyz.addAssign(ref0.zzz.mul(pos0));
            covariance.element(0).xyz.addAssign(ref1.xxx.mul(pos1));
            covariance.element(1).xyz.addAssign(ref1.yyy.mul(pos1));
            covariance.element(2).xyz.addAssign(ref1.zzz.mul(pos1));
            covariance.element(0).xyz.addAssign(ref2.xxx.mul(pos2));
            covariance.element(1).xyz.addAssign(ref2.yyy.mul(pos2));
            covariance.element(2).xyz.addAssign(ref2.zzz.mul(pos2));
            covariance.element(0).xyz.addAssign(ref3.xxx.mul(pos3));
            covariance.element(1).xyz.addAssign(ref3.yyy.mul(pos3));
            covariance.element(2).xyz.addAssign(ref3.zzz.mul(pos3));
            const rotation = extractRotation(covariance, vec4(0.0, 0.0, 0.0, 1.0), this.uniforms.rotationRefinementSteps);

            // Write out the undeformed tetrahedron
            const prevQuat = tetBuffer.get(instanceIndex, "quat").toVar();
            const newQuat = normalize(quat_mult(rotation, prevQuat)); // Keep track of the current Quaternion for normals
            tetBuffer.get(instanceIndex, "quat").assign(newQuat);

            const relativeQuat = normalize(quat_mult(newQuat, quat_conj(prevQuat)));

            // Rotate the undeformed tetrahedron by the deformed's rotationf
            ref0.assign(rotateByQuat(ref0, relativeQuat).add(curCentroid));
            ref1.assign(rotateByQuat(ref1, relativeQuat).add(curCentroid));
            ref2.assign(rotateByQuat(ref2, relativeQuat).add(curCentroid));
            ref3.assign(rotateByQuat(ref3, relativeQuat).add(curCentroid));

            tetBuffer.get(instanceIndex, "centroid").assign(curCentroid);
            restPosesBuffer.get(instanceIndex.mul(4), "position").assign(ref0);
            restPosesBuffer.get(instanceIndex.mul(4).add(1), "position").assign(ref1);
            restPosesBuffer.get(instanceIndex.mul(4).add(2), "position").assign(ref2);
            restPosesBuffer.get(instanceIndex.mul(4).add(3), "position").assign(ref3);

            const ipos = ivec3(curCentroid.div(hashingCellSize).floor());
            const hash = murmurHash13(ipos).mod(uint(hashMapSize)).toVar("hash");
            //const storeNode = this.tetPtrBuffer.element(instanceIndex);
            //const prev = atomicFunc("atomicExchange", this.hashBuffer.element(hash), instanceIndex, 0));
            tetBuffer.get(instanceIndex, "nextTet").assign(atomicFunc("atomicExchange", this.hashBuffer.element(hash), instanceIndex));

        })().compute(this.tetCount);
        console.time("solveElemPass");
        await this.renderer.computeAsync(this.kernels.solveElemPass); //call once to compile
        console.timeEnd("solveElemPass");


        this.kernels.solveCollisions = Fn(() => {
            this.hashBuffer.setAtomic(false);
            If(instanceIndex.greaterThanEqual(this.uniforms.tetCount), () => {
                Return();
            });
            const objectId = tetBuffer.get(instanceIndex, "objectId").toVar();
            const size = objectBuffer.get(objectId, "size");
            If(size.lessThan(0.0001), () => {
                Return();
            });

            const centroid = tetBuffer.get(instanceIndex, "centroid").toVar("centroid");
            const position = centroid.toVar("pos");
            const radius = tetBuffer.get(instanceIndex, "radius").toVar();
            const initialPosition = tetBuffer.get(instanceIndex, "initialPosition").toVar();

            const cellIndex =  ivec3(position.div(hashingCellSize).floor()).sub(1).toConst("cellIndex");
            const diff = vec3(0).toVar();
            const totalForce = float(0).toVar();

            //If(uint(1).greaterThan(uint(0)), () => { Return(); });
            Loop({ start: 0, end: 3, type: 'int', name: 'gx', condition: '<' }, ({gx}) => {
                Loop({ start: 0, end: 3, type: 'int', name: 'gy', condition: '<' }, ({gy}) => {
                    Loop({ start: 0, end: 3, type: 'int', name: 'gz', condition: '<' }, ({gz}) => {
                        const cellX = cellIndex.add(ivec3(gx,gy,gz)).toConst();
                        const hash = murmurHash13(cellX).mod(uint(hashMapSize));
                        const tetPtr = this.hashBuffer.element(hash).toVar('tetPtr');
                        Loop(tetPtr.notEqual(int(-1)), () => {
                            const checkCollision = uint(1).toVar();
                            const objectId2 = tetBuffer.get(tetPtr, "objectId");
                            If(objectId.equal(objectId2), () => {
                                const initialPosition2 = tetBuffer.get(tetPtr, "initialPosition")
                                const delta = initialPosition2.sub(initialPosition).toVar();
                                const distSquared = dot(delta,delta);
                                checkCollision.assign(select(distSquared.greaterThan(1.5*1.5), uint(1), uint(0)));
                            });

                            If(checkCollision.equal(uint(1)), () => {
                                const centroid_2 = tetBuffer.get(tetPtr, "centroid").toVar("centroid2");
                                const radius2 = tetBuffer.get(tetPtr, "radius").toVar();

                                const minDist = radius.add(radius2);
                                const dist = centroid.distance(centroid_2);
                                const dir = centroid.sub(centroid_2).div(dist);
                                const force = minDist.sub(dist).max(0);
                                totalForce.addAssign(force.div(minDist));
                                diff.addAssign(dir.mul(force).mul(0.5));
                            });
                            tetPtr.assign(tetBuffer.get(tetPtr, "nextTet"));
                        })
                    });
                });
            });
            If(totalForce.greaterThan(0.0), () => {
                //diff.divAssign(totalForce);
                restPosesBuffer.get(instanceIndex.mul(4), "position").addAssign(diff);
                restPosesBuffer.get(instanceIndex.mul(4).add(1), "position").addAssign(diff);
                restPosesBuffer.get(instanceIndex.mul(4).add(2), "position").addAssign(diff);
                restPosesBuffer.get(instanceIndex.mul(4).add(3), "position").addAssign(diff);
            });
        })().compute(this.tetCount);
        console.time("solveCollisions");
        await this.renderer.computeAsync(this.kernels.solveCollisions); //call once to compile
        console.timeEnd("solveCollisions");


        this.kernels.applyElemPass = Fn(()=>{
            this.hashBuffer.setAtomic(false);
            If(instanceIndex.greaterThanEqual(this.uniforms.vertexCount), () => {
                Return();
            });
            const objectId = vertexBuffer.get(instanceIndex, "objectId");
            const size = objectBuffer.get(objectId, "size");
            If(size.lessThan(0.0001), () => {
                Return();
            });

            const prevPosition = vertexBuffer.get(instanceIndex, "prevPosition").toVar();
            const ptrStart = vertexBuffer.get(instanceIndex, "influencerPtr").toVar();
            const ptrEnd = ptrStart.add(vertexBuffer.get(instanceIndex, "influencerCount")).toVar();
            const position = vec3().toVar();
            const weight = float().toVar();
            Loop({ start: ptrStart, end: ptrEnd,  type: 'uint', condition: '<' }, ({ i })=>{
                const restPositionPtr = this.influencerBuffer.element(i);
                const restPosition = restPosesBuffer.get(restPositionPtr, "position");
                const restVolume = restPosesBuffer.get(restPositionPtr, "restVolume");
                position.addAssign(restPosition.mul(restVolume));
                weight.addAssign(restVolume);
            });
            position.divAssign(weight);
            //const currentPosition = this.positionBuffer.element(instanceIndex).toVar();

            vertexBuffer.get(instanceIndex, "prevPosition").assign(position);

            const { dt, gravity } = this.uniforms;
            const gravity2 = position.normalize().mul(-9.81).mul(1);
            const velocity = position.sub(prevPosition).div(dt).add(gravity2.mul(dt)).mul(0.999);
            position.addAssign(velocity.mul(dt));

            const F = prevPosition.sub(position);
            const frictionDir = vec3(0).toVar();
            this.colliders.forEach((collider) => {
                const colliderResult = collider(position);
                const diff = colliderResult.w.min(0).negate().toVar();
                position.addAssign(diff.mul(colliderResult.xyz));
                frictionDir.addAssign(colliderResult.xyz.abs().oneMinus().mul(diff.sign()));
            });
            position.xyz.addAssign(F.mul(frictionDir).mul(min(1.0, dt.mul(100))));

            vertexBuffer.get(instanceIndex, "position").assign(position);
        })().compute(this.vertexCount);
        console.time("applyElemPass");
        await this.renderer.computeAsync(this.kernels.applyElemPass); //call once to compile
        console.timeEnd("applyElemPass");


        // ######################
        //  CREATE RESET KERNELS
        // ######################

        this.uniforms.resetVertexStart = uniform(0, "uint");
        this.uniforms.resetVertexCount = uniform(0, "uint");
        this.uniforms.resetOffset = uniform(new THREE.Vector3());
        this.uniforms.resetVelocity = uniform(new THREE.Vector3());
        this.uniforms.resetScale = uniform(1.0, "float");
        this.kernels.resetVertices = Fn(()=>{
            If(instanceIndex.greaterThanEqual(this.uniforms.resetVertexCount), () => {
                Return();
            });
            const vertexId = this.uniforms.resetVertexStart.add(instanceIndex).toVar();

            If(instanceIndex.equal(uint(0)), () => {
                const objectId = vertexBuffer.get(vertexId, "objectId").toVar();
                objectBuffer.get(objectId, "size").assign(1.0);
            });


            const initialPosition = vertexBuffer.get(vertexId, "initialPosition").mul(this.uniforms.resetScale).add(this.uniforms.resetOffset).toVar();
            vertexBuffer.get(vertexId, "position").assign(initialPosition);
            vertexBuffer.get(vertexId, "prevPosition").assign(initialPosition.sub(this.uniforms.resetVelocity));
        })().compute(this.vertexCount);
        console.time("resetVertices");
        await this.renderer.computeAsync(this.kernels.resetVertices); //call once to compile
        console.timeEnd("resetVertices");


        this.uniforms.resetTetStart = uniform(0, "uint");
        this.uniforms.resetTetCount = uniform(0, "uint");
        this.kernels.resetTets = Fn(() => {
            If(instanceIndex.greaterThanEqual(this.uniforms.resetTetCount), () => {
                Return();
            });
            const tetId = this.uniforms.resetTetStart.add(instanceIndex).toVar();
            const volume  = tetBuffer.get(tetId, "restVolume").toVar();

            // Gather this tetrahedron's 4 vertex positions
            const vertexIds = tetBuffer.get(tetId, "vertexIds");
            const pos0 = vertexBuffer.get(vertexIds.x, "initialPosition").mul(this.uniforms.resetScale).add(this.uniforms.resetOffset).toVar();
            const pos1 = vertexBuffer.get(vertexIds.y, "initialPosition").mul(this.uniforms.resetScale).add(this.uniforms.resetOffset).toVar();
            const pos2 = vertexBuffer.get(vertexIds.z, "initialPosition").mul(this.uniforms.resetScale).add(this.uniforms.resetOffset).toVar();
            const pos3 = vertexBuffer.get(vertexIds.w, "initialPosition").mul(this.uniforms.resetScale).add(this.uniforms.resetOffset).toVar();

            restPosesBuffer.get(tetId.mul(4), "position").assign(pos0);
            restPosesBuffer.get(tetId.mul(4).add(1), "position").assign(pos1);
            restPosesBuffer.get(tetId.mul(4).add(2), "position").assign(pos2);
            restPosesBuffer.get(tetId.mul(4).add(3), "position").assign(pos3);
            tetBuffer.get(tetId, "quat").assign(vec4(0,0,0,1));
        })().compute(this.tetCount);
        console.time("resetTets");
        await this.renderer.computeAsync(this.kernels.resetTets); //call once to compile
        console.timeEnd("resetTets");

        this.uniforms.objectStart = uniform(0, "uint");
        this.kernels.resetObjects = Fn(() => {
            const objectId = this.uniforms.objectStart.add(instanceIndex).toVar();
            objectBuffer.get(objectId, "size").assign(0.0);
        })().compute(this.objects.length);


        // ##################################
        //  CREATE MOUSE INTERACTION KERNELS
        // ##################################

        this.uniforms.mouseRayOrigin = uniform(new THREE.Vector3());
        this.uniforms.mouseRayDirection = uniform(new THREE.Vector3());
        this.kernels.applyMouseEvent = Fn(()=>{
            If(instanceIndex.greaterThanEqual(this.uniforms.vertexCount), () => {
                Return();
            });

            const objectId = vertexBuffer.get(instanceIndex, "objectId");
            const size = objectBuffer.get(objectId, "size");
            If(size.lessThan(0.0001), () => {
                Return();
            });

            const { mouseRayOrigin, mouseRayDirection } = this.uniforms;
            const position = vertexBuffer.get(instanceIndex, "position").toVar();
            const prevPosition = vertexBuffer.get(instanceIndex, "prevPosition");

            const dist = cross(mouseRayDirection, position.sub(mouseRayOrigin)).length()
            const force = dist.mul(0.3).oneMinus().max(0.0).pow(0.5);
            prevPosition.addAssign(vec3(0,-0.25,0).mul(force));
        })().compute(this.vertexCount);
        console.time("applyMouseEvent");
        await this.renderer.computeAsync(this.kernels.applyMouseEvent); //call once to compile
        console.timeEnd("applyMouseEvent");


        // #############################
        //  CREATE POSITION READ KERNEL
        // #############################

        const centerVertexArray = new Uint32Array(this.objectData.map(d => d.centerVertex.id));
        this.centerVertexBuffer = instancedArray(centerVertexArray, 'uint');
        this.positionReadbackBuffer = instancedArray(new Float32Array(this.objects.length*3), 'vec3');
        this.kernels.readPositions = Fn(()=>{
            const centerVertex = this.centerVertexBuffer.element(instanceIndex);
            const position = vertexBuffer.get(centerVertex, "position");
            this.positionReadbackBuffer.element(instanceIndex).assign(position);
        })().compute(this.objects.length);
        await this.renderer.computeAsync(this.kernels.readPositions); //call once to compile


        // ####################
        //  BAKE OTHER OBJECTS
        // ####################

        const geometryPromises = this.geometries.map(geom => geom.bake(this));
        await Promise.all(geometryPromises);
    }

    async readPositions() {
        await this.renderer.computeAsync(this.kernels.readPositions);
        const positions = new Float32Array(await this.renderer.getArrayBufferAsync(this.positionReadbackBuffer.value));
        this.objectData.forEach((o, index) => {
            const x = positions[index*4+0];
            const y = positions[index*4+1];
            const z = positions[index*4+2];
            o.position.set(x,y,z);
        });
    }

    async resetObject(id, position, scale, velocity = new THREE.Vector3()) {
        this.objectData[id].position.copy(position);
        this.uniforms.resetVertexStart.value = this.objectData[id].vertexStart;
        this.uniforms.resetVertexCount.value = this.objectData[id].vertexCount;
        this.uniforms.resetTetStart.value = this.objectData[id].tetStart;
        this.uniforms.resetTetCount.value = this.objectData[id].tetCount;
        this.uniforms.resetOffset.value.copy(position);
        this.uniforms.resetVelocity.value.copy(velocity);
        this.uniforms.resetScale.value = scale;
        this.kernels.resetVertices.count = this.objectData[id].vertexCount;
        this.kernels.resetTets.count = this.objectData[id].tetCount;
        this.kernels.resetVertices.updateDispatchCount();
        this.kernels.resetTets.updateDispatchCount();
        await this.renderer.computeAsync(this.kernels.resetVertices);
        await this.renderer.computeAsync(this.kernels.resetTets);
    }

    async onPointerDown(origin, direction) {
        this.uniforms.mouseRayOrigin.value.copy(origin);
        this.uniforms.mouseRayDirection.value.copy(direction);
        await this.renderer.computeAsync(this.kernels.applyMouseEvent);
    }

    async update(interval, elapsed) {
        const { stepsPerSecond, bodies } = conf;
        this.frameNum++;

        if (bodies !== this.objectCount) {
            this.objectCount = bodies;
            for (let i=this.objectCount; i<this.objects.length; i++) {
                this.objects[i].spawned = false;
            }

            this.geometries.forEach(geom => geom.updateCount());

            const lastObject = this.objectData[this.objectCount - 1];
            const tetCount = lastObject.tetStart + lastObject.tetCount;
            const vertexCount = lastObject.vertexStart + lastObject.vertexCount;

            this.uniforms.tetCount.value = tetCount;
            this.uniforms.vertexCount.value = vertexCount;

            this.kernels.solveElemPass.count = tetCount;
            this.kernels.solveCollisions.count = tetCount;
            this.kernels.applyElemPass.count = vertexCount;
            this.kernels.applyMouseEvent.count = vertexCount;

            this.kernels.solveElemPass.updateDispatchCount();
            this.kernels.solveCollisions.updateDispatchCount();
            this.kernels.applyElemPass.updateDispatchCount();
            this.kernels.applyMouseEvent.updateDispatchCount();

            this.uniforms.objectStart.value = this.objectCount;
            await this.renderer.computeAsync(this.kernels.resetObjects);
        }

        if (this.frameNum % 50 === 0) {
            //this.readPositions().then(() => {}); // no await to prevent blocking!
        }


        const timePerStep = 1 / stepsPerSecond;

        interval = Math.max(Math.min(interval, 1/60), 0.0001);
        this.uniforms.dt.value = timePerStep;

        this.timeSinceLastStep += interval;

        for (let i=0; i<this.objects.length; i++) {
            const object = this.objects[i];
            await object.update(interval, elapsed);
        }

        while (this.timeSinceLastStep >= timePerStep) {
            this.time += timePerStep;
            this.timeSinceLastStep -= timePerStep;
            this.uniforms.time.value = this.time;
            await this.renderer.computeAsync(this.kernels.clearHashMap);
            await this.renderer.computeAsync(this.kernels.solveElemPass);
            await this.renderer.computeAsync(this.kernels.solveCollisions);
            await this.renderer.computeAsync(this.kernels.applyElemPass);
        }


        if (this.frameNum > 1) {
            //const hashMap = new Int32Array(await this.renderer.getArrayBufferAsync(this.initialTetPositionBuffer.value));
            //console.log(hashMap);
        }
    }
}