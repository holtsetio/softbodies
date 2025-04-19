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
import {mx_hash_int, mx_perlin_noise_float} from "three/src/nodes/materialx/lib/mx_noise";
import {SoftbodyModel} from "./softbodyModel";
import {conf} from "../conf";

console.log(atomicAdd, atomicFunc, 2);
export const murmurHash13 = /*#__PURE__*/ Fn( ( [ src_immutable ] ) => {
    const src = uvec3( src_immutable ).toVar();
    const M = uint( int( 0x5bd1e995 ) );
    const h = uint( uint( 1190494759 ) ).toVar();
    src.mulAssign( M );
    src.bitXorAssign( src.shiftRight( uvec3( 24 ) ) );
    src.mulAssign( M );
    h.mulAssign( M );
    h.bitXorAssign( src.x );
    h.mulAssign( M );
    h.bitXorAssign( src.y );
    h.mulAssign( M );
    h.bitXorAssign( src.z );
    h.bitXorAssign( h.shiftRight( uint( 13 ) ) );
    h.mulAssign( M );
    h.bitXorAssign( h.shiftRight( uint( 15 ) ) );
    return h;
} ).setLayout( {
    name: 'murmurHash13',
    type: 'uint',
    inputs: [
        { name: 'src', type: 'uvec3' }
    ]
} );


export const RotationToQuaternion = /*#__PURE__*/ Fn( ( [ axis_immutable, angle_immutable ] ) => {

    const angle = float( angle_immutable ).toVar();
    const axis = vec3( axis_immutable ).toVar();
    const half_angle = float( angle.mul( 0.5 ) ).toVar();
    const s = vec2( sin( vec2( half_angle, half_angle.add( Math.PI * 0.5 ) ) ) ).toVar();

    return vec4( axis.mul( s.x ), s.y );

} ).setLayout( {
    name: 'RotationToQuaternion',
    type: 'vec4',
    inputs: [
        { name: 'axis', type: 'vec3' },
        { name: 'angle', type: 'float' }
    ]
} );

export const Rotate = /*#__PURE__*/ Fn( ( [ pos_immutable, quat_immutable ] ) => {

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

export const quat_conj = /*#__PURE__*/ Fn( ( [ q_immutable ] ) => {

    const q = vec4( q_immutable ).toVar();

    return normalize( vec4( q.x.negate(), q.y.negate(), q.z.negate(), q.w ) );

} ).setLayout( {
    name: 'quat_conj',
    type: 'vec4',
    inputs: [
        { name: 'q', type: 'vec4' }
    ]
} );


export const quat_mult = /*#__PURE__*/ Fn( ( [ q1_immutable, q2_immutable ] ) => {

    const q2 = vec4( q2_immutable ).toVar();
    const q1 = vec4( q1_immutable ).toVar();
    const qr = vec4().toVar();
    qr.x.assign( q1.w.mul( q2.x ).add( q1.x.mul( q2.w ) ).add( q1.y.mul( q2.z ).sub( q1.z.mul( q2.y ) ) ) );
    qr.y.assign( q1.w.mul( q2.y ).sub( q1.x.mul( q2.z ) ).add( q1.y.mul( q2.w ) ).add( q1.z.mul( q2.x ) ) );
    qr.z.assign( q1.w.mul( q2.z ).add( q1.x.mul( q2.y ).sub( q1.y.mul( q2.x ) ) ).add( q1.z.mul( q2.w ) ) );
    qr.w.assign( q1.w.mul( q2.w ).sub( q1.x.mul( q2.x ) ).sub( q1.y.mul( q2.y ) ).sub( q1.z.mul( q2.z ) ) );

    return qr;

} ).setLayout( {
    name: 'quat_mult',
    type: 'vec4',
    inputs: [
        { name: 'q1', type: 'vec4' },
        { name: 'q2', type: 'vec4' }
    ]
} );

export const extractRotation = /*#__PURE__*/ Fn( ( [ A_immutable, q_immutable ] ) => {

    const q = vec4( q_immutable ).toVar();
    const A = mat3( A_immutable ).toVar();

    Loop( { start: int( 0 ), end: int( 9 ), name: 'iter' }, ( { iter } ) => {

        const X = vec3( Rotate( vec3( 1.0, 0.0, 0.0 ), q ) ).toVar();
        const Y = vec3( Rotate( vec3( 0.0, 1.0, 0.0 ), q ) ).toVar();
        const Z = vec3( Rotate( vec3( 0.0, 0.0, 1.0 ), q ) ).toVar();
        const omega = vec3( cross( X, A.element( int( 0 ) ) ).add( cross( Y, A.element( int( 1 ) ) ) ).add( cross( Z, A.element( int( 2 ) ) ) ).mul( div( 1.0, abs( dot( X, A.element( int( 0 ) ) ).add( dot( Y, A.element( int( 1 ) ) ) ).add( dot( Z, A.element( int( 2 ) ) ) ).add( 0.000000001 ) ) ) ) ).toVar();
        const w = float( length( omega ) ).toVar();

        If( w.lessThan( 0.000000001 ), () => {
            Break();
        } );

        q.assign( quat_mult( RotationToQuaternion( omega.div( w ), w ), q ) );

    } );

    return q;

} ).setLayout( {
    name: 'extractRotation',
    type: 'vec4',
    inputs: [
        { name: 'A', type: 'mat3' },
        { name: 'q', type: 'vec4' }
    ]
} );


export class FEMPhysics {
    vertices = [];

    tets = [];

    triangles = [];

    objects = [];

    objectData = [];

    geometries = [];

    vertexCount = 0;

    tetCount = 0;

    triangleCount = 0;

    density = 1000;

    kernels = {};

    uniforms = {};

    time = 0;

    frameNum = 0;

    timeSinceLastStep = 0;

    colliders = [];

    constructor(renderer) {
        this.renderer = renderer;
    }

    addVertex(objectId,x,y,z) {
        const id = this.vertexCount;
        const vertex = new THREE.Vector3(x,y,z);
        vertex.id = id;
        vertex.objectId = objectId;
        vertex.influencers = [];
        vertex.triangles = [];
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

    addTriangle(objectId, v0, v1, v2) {
        const id = this.triangleCount;
        const triangle = {id,v0,v1,v2,objectId};
        this.triangles.push(triangle);
        this.objectData[objectId].triangleCount++;
        this.triangleCount++;
        return triangle;
    }

    _addObject(object) {
        const id = this.objects.length;
        this.objects.push(object);
        this.objectData.push({
            centerVertexDistance: 1e9,
            centerVertex: null,
            tetStart: this.tetCount,
            tetCount: 0,
            vertexStart: this.vertexCount,
            vertexCount: 0,
            triangleStart: this.triangleCount,
            triangleCount: 0,
            position: new THREE.Vector3(),
        });
        return id;
    }

    addGeometry(model, materialClass = THREE.MeshPhysicalNodeMaterial) {
        const id = this.geometries.length;
        const material = SoftbodyModel.createMaterial(this, materialClass);
        const geometry = { id, model, material }
        this.geometries.push(geometry);
        return geometry;
    }

    addInstance(geometry) {
        const object = new SoftbodyModel(this, geometry);
        return object;
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
        console.log(this.triangleCount + " triangles");

        let length = 0;
        this.triangles.forEach(triangle => {
            const { v0, v1, v2 } = triangle;
            length += v0.distanceTo(v1);
            length += v1.distanceTo(v2);
            length += v2.distanceTo(v0);
        })
        console.log("avg triangleSide: " + (length / (this.triangles.length * 3)));

        const oldrestingPose = new THREE.Matrix3();
        const restVolumeArray = new Float32Array(this.tetCount);
        const invMassArray = new Float32Array(this.vertexCount);
        const radiusArray = new Float32Array(this.tetCount);
        const quatsArray = new Float32Array(this.tetCount*4);
        const restPosesArray = new Float32Array(this.tetCount*4*4);
        const tetObjectIdArray = new Uint32Array(this.tetCount);
        const vertexObjectIdArray = new Uint32Array(this.vertexCount);
        const initialTetPositionArray = new Float32Array(this.tetCount * 3);

        let maxR = 0;
        this.tets.forEach((tet,index) => {
            const { v0, v1, v2, v3 } = tet;
            [v0, v1, v2, v3].forEach((vertex,subindex) => {
                restPosesArray[(index*4+subindex)*4 + 0] = vertex.x;
                restPosesArray[(index*4+subindex)*4 + 1] = vertex.y;
                restPosesArray[(index*4+subindex)*4 + 2] = vertex.z;
                restPosesArray[(index*4+subindex)*4 + 3] = 0;
            });
            const center = v0.clone().add(v1).add(v2).add(v3).multiplyScalar(0.25);
            initialTetPositionArray[index*3 + 0] = center.x;
            initialTetPositionArray[index*3 + 1] = center.y;
            initialTetPositionArray[index*3 + 2] = center.z;


            const e = oldrestingPose.elements;
            e[0] = v1.x - v0.x;
            e[3] = v1.y - v0.y;
            e[6] = v1.z - v0.z;
            e[1] = v2.x - v0.x;
            e[4] = v2.y - v0.y;
            e[7] = v2.z - v0.z;
            e[2] = v3.x - v0.x;
            e[5] = v3.y - v0.y;
            e[8] = v3.z - v0.z;
            const V = oldrestingPose.determinant() / 6;
            let pm = V / 4.0 * this.density;
            invMassArray[v0.id] += pm;
            invMassArray[v1.id] += pm;
            invMassArray[v2.id] += pm;
            invMassArray[v3.id] += pm;
            restVolumeArray[index] = V;
            quatsArray[index*4+0] = 0;
            quatsArray[index*4+1] = 0;
            quatsArray[index*4+2] = 0;
            quatsArray[index*4+3] = 1;
            tetObjectIdArray[index] = tet.objectId;

            const radius = (Math.pow((3/4) * V / Math.PI, 1/3));
            radiusArray[index] = radius;
            maxR = Math.max(maxR, radius);
        });
        console.log("maxRadius", maxR);

        const positionArray = new Float32Array(this.vertexCount * 3);
        const influencerPtrArray = new Uint32Array(this.vertexCount * 2); // x: ptr, y: length
        const influencerArray = new Uint32Array(this.tetCount * 4);
        let influencerPtr = 0;
        this.vertices.forEach((vertex, index) => {
            positionArray[index*3+0] = vertex.x * 1.0;// + Math.random() * 0.001;
            positionArray[index*3+1] = vertex.y * 1.0;// + Math.random() * 0.001;
            positionArray[index*3+2] = vertex.z * 1.0;// + Math.random() * 0.001;
            influencerPtrArray[index * 2 + 0] = influencerPtr;
            influencerPtrArray[index * 2 + 1] = vertex.influencers.length;
            vertex.influencers.forEach(influencer => {
                influencerArray[influencerPtr] = influencer;
                influencerPtr++;
            });
            if (invMassArray[index] !== 0.0) {
                invMassArray[index] = 1 / invMassArray[index];
            }
            vertexObjectIdArray[index] = vertex.objectId;
        });

        const tetArray = new Int32Array(this.tetCount * 4);
        this.tets.forEach((tet,index) => {
            const { v0,v1,v2,v3 } = tet;
            tetArray[index*4+0] = v0.id;
            tetArray[index*4+1] = v1.id;
            tetArray[index*4+2] = v2.id;
            tetArray[index*4+3] = v3.id;
        });


        this.initialPositionBuffer = instancedArray(positionArray, 'vec3');
        this.positionBuffer = instancedArray(positionArray, 'vec3');
        this.positionBuffer2 = instancedArray(positionArray, 'vec3');
        this.prevPositionBuffer = instancedArray(positionArray, 'vec3');
        this.influencerPtrBuffer = instancedArray(influencerPtrArray, 'uvec2');
        this.influencerBuffer = instancedArray(influencerArray, 'uint');
        this.tetBuffer = instancedArray(tetArray, 'ivec4');
        this.restPosesBuffer = instancedArray(restPosesArray, 'vec4');
        this.quatsBuffer = instancedArray(quatsArray, 'vec4');
        this.invMassBuffer = instancedArray(invMassArray, 'float');
        this.restVolumeBuffer = instancedArray(restVolumeArray, 'float');
        this.radiusBuffer = instancedArray(radiusArray, 'float');
        this.tetPtrBuffer = instancedArray(this.tets.length, "int");
        this.centroidBuffer = instancedArray(this.tets.length, "vec3");
        this.initialTetPositionBuffer = instancedArray(initialTetPositionArray, "vec3");

        const triangleStruct = struct( {
            vertices: { type: 'ivec3' },
            objectId: { type: 'uint' },
            ptr: { type: 'int' },
        } );
        console.log(triangleStruct);
        const triangleStride = 8;

        const triangleArrayI32 = new Int32Array(this.triangleCount * triangleStride);
        const triangleArrayF32 = new Float32Array(triangleArrayI32.buffer);
        this.triangles.forEach((triangle, index) => {
            const { v0,v1,v2,objectId } = triangle;
            triangleArrayI32[index*triangleStride+0] = v0.id;
            triangleArrayI32[index*triangleStride+1] = v1.id;
            triangleArrayI32[index*triangleStride+2] = v2.id;
            triangleArrayI32[index*triangleStride+3] = objectId;
            triangleArrayI32[index*triangleStride+4] = 1337;
            triangleArrayI32[index*triangleStride+5] = 1338;
            triangleArrayI32[index*triangleStride+6] = 1339;
            triangleArrayI32[index*triangleStride+7] = 1340;
        });

        this.triangleBuffer = instancedArray(triangleArrayI32, triangleStruct);
        //this.triangleObjectIdBuffer = instancedArray(triangleObjectIdArray, 'uint');
        //this.trianglePtrBuffer = instancedArray(triangleArray.length, 'int');
        const hashMapSize = 1048573; //
        const hashingCellSize = 0.36
        this.hashBuffer = instancedArray(hashMapSize, "int").toAtomic();


        this.tetObjectIdBuffer = instancedArray(tetObjectIdArray, 'uint');
        this.vertexObjectIdBuffer = instancedArray(vertexObjectIdArray, 'uint');

        this.uniforms.vertexCount = uniform(this.vertexCount, "int");
        this.uniforms.tetCount = uniform(this.tetCount, "int");
        this.uniforms.triangleCount = uniform(this.triangleCount, "int");
        this.uniforms.time = uniform(0, "float");
        this.uniforms.dt = uniform(1, "float");
        this.uniforms.gravity = uniform(new THREE.Vector3(0,-9.81*2,0), "vec3");

        this.kernels.solveElemPass = Fn(() => {
            this.hashBuffer.setAtomic(true);
            If(instanceIndex.greaterThanEqual(this.uniforms.tetCount), () => {
                Return();
            });
            // Gather this tetrahedron's 4 vertex positions
            const vertexIds = this.tetBuffer.element(instanceIndex);
            const pos0 = this.positionBuffer.element(vertexIds.x).toVar();
            const pos1 = this.positionBuffer.element(vertexIds.y).toVar();
            const pos2 = this.positionBuffer.element(vertexIds.z).toVar();
            const pos3 = this.positionBuffer.element(vertexIds.w).toVar();

            // The Reference Rest Pose Positions
            // These are the same as the resting pose, but they're already pre-rotated
            // to a good approximation of the current pose
            const ref0 = this.restPosesBuffer.element(instanceIndex.mul(4)).xyz.toVar();
            const ref1 = this.restPosesBuffer.element(instanceIndex.mul(4).add(1)).xyz.toVar();
            const ref2 = this.restPosesBuffer.element(instanceIndex.mul(4).add(2)).xyz.toVar();
            const ref3 = this.restPosesBuffer.element(instanceIndex.mul(4).add(3)).xyz.toVar();

            // Get the centroids
            const curCentroid = pos0.add(pos1).add(pos2).add(pos3).mul(0.25).toVar();
            const lastRestCentroid = ref0.add(ref1).add(ref2).add(ref3).mul(0.25).toVar();

            console.log("LOL", curCentroid);
            console.log("LOL", curCentroid.uuid);
            // Center the Deformed Tetrahedron
            pos0.subAssign(curCentroid);

            console.log("LOL2", curCentroid.uuid);
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
            const rotation = extractRotation(covariance, vec4(0.0, 0.0, 0.0, 1.0));

            // Write out the undeformed tetrahedron
            const prevQuat = this.quatsBuffer.element(instanceIndex).toVar();
            const newQuat = normalize(quat_mult(rotation, prevQuat)); // Keep track of the current Quaternion for normals
            this.quatsBuffer.element(instanceIndex).assign(newQuat);

            const volume  = this.restVolumeBuffer.element(instanceIndex).toVar();
            const relativeQuat = normalize(quat_mult(newQuat, quat_conj(prevQuat)));

            // Rotate the undeformed tetrahedron by the deformed's rotationf
            ref0.assign(Rotate(ref0, relativeQuat).add(curCentroid));
            ref1.assign(Rotate(ref1, relativeQuat).add(curCentroid));
            ref2.assign(Rotate(ref2, relativeQuat).add(curCentroid));
            ref3.assign(Rotate(ref3, relativeQuat).add(curCentroid));

            this.centroidBuffer.element(instanceIndex).assign(curCentroid);
            this.restPosesBuffer.element(instanceIndex.mul(4)).assign(vec4(ref0, volume));
            this.restPosesBuffer.element(instanceIndex.mul(4).add(1)).assign(vec4(ref1, volume));
            this.restPosesBuffer.element(instanceIndex.mul(4).add(2)).assign(vec4(ref2, volume));
            this.restPosesBuffer.element(instanceIndex.mul(4).add(3)).assign(vec4(ref3, volume));



            const ipos = ivec3(curCentroid.div(hashingCellSize).floor());
            const hash = mx_hash_int(ipos.x, ipos.y, ipos.z).mod(uint(hashMapSize)).toVar("hash");
            //const storeNode = this.tetPtrBuffer.element(instanceIndex);
            //const prev = atomicFunc("atomicExchange", this.hashBuffer.element(hash), instanceIndex, 0));
            this.tetPtrBuffer.element(instanceIndex).assign(atomicFunc("atomicExchange", this.hashBuffer.element(hash), instanceIndex));

        })().compute(this.tetCount);

        this.kernels.solveCollisions = Fn(() => {
            this.hashBuffer.setAtomic(false);
            If(instanceIndex.greaterThanEqual(this.uniforms.tetCount), () => {
                Return();
            });
            const centroid = this.centroidBuffer.element(instanceIndex).toVar("centroid");
            const position = centroid.toVar("pos");
            const radius = this.radiusBuffer.element(instanceIndex).toVar();
            const initialPosition = this.initialTetPositionBuffer.element(instanceIndex);

            const cellIndex =  ivec3(position.div(hashingCellSize).floor()).sub(1).toConst("cellIndex");
            const objectId = this.tetObjectIdBuffer.element(instanceIndex);
            const diff = vec3(0).toVar();
            const totalForce = float(0).toVar();


            Loop({ start: 0, end: 3, type: 'int', name: 'gx', condition: '<' }, ({gx}) => {
                Loop({ start: 0, end: 3, type: 'int', name: 'gy', condition: '<' }, ({gy}) => {
                    Loop({ start: 0, end: 3, type: 'int', name: 'gz', condition: '<' }, ({gz}) => {
                        const cellX = cellIndex.add(ivec3(gx,gy,gz)).toConst();
                        const hash = mx_hash_int(cellX.x, cellX.y, cellX.z).mod(uint(hashMapSize));
                        const tetPtr = this.hashBuffer.element(hash).toVar('tetPtr');
                        Loop(tetPtr.notEqual(int(-1)), () => {
                            const checkCollision = uint(1).toVar();
                            const objectId2 = this.tetObjectIdBuffer.element(tetPtr);
                            If(objectId.equal(objectId2), () => {
                                const initialPosition2 = this.initialTetPositionBuffer.element(tetPtr);
                                const delta = initialPosition2.sub(initialPosition).toVar();
                                const distSquared = dot(delta,delta);
                                checkCollision.assign(select(distSquared.greaterThan(0.5*0.5), uint(1), uint(0)));
                            });

                            If(checkCollision.equal(uint(1)), () => {
                                const centroid_2 = this.centroidBuffer.element(tetPtr).toVar("centroid2");
                                const radius2 = this.radiusBuffer.element(tetPtr).toVar();

                                const minDist = radius.add(radius2).mul(3).mul(1.0);
                                const dist = centroid.distance(centroid_2);
                                const dir = centroid.sub(centroid_2).div(dist);
                                const force = minDist.sub(dist).max(0);
                                totalForce.addAssign(force.div(minDist));
                                diff.addAssign(dir.mul(force).mul(0.5));
                            });
                            tetPtr.assign(this.tetPtrBuffer.element(tetPtr));
                        })
                    });
                });
            });
            If(totalForce.greaterThan(0.0), () => {
                //diff.divAssign(totalForce);
                this.restPosesBuffer.element(instanceIndex.mul(4)).xyz.addAssign(diff);
                this.restPosesBuffer.element(instanceIndex.mul(4).add(1)).xyz.addAssign(diff);
                this.restPosesBuffer.element(instanceIndex.mul(4).add(2)).xyz.addAssign(diff);
                this.restPosesBuffer.element(instanceIndex.mul(4).add(3)).xyz.addAssign(diff);
            });


        })().debug().compute(this.tetCount);

        this.kernels.clearHashMap = Fn(() => {
            this.hashBuffer.setAtomic(false);
            /*If(instanceIndex.greaterThanEqual(uint(hashMapSize)), () => {
                Return();
            });*/
            this.hashBuffer.element(instanceIndex).assign(-1);
        })().compute(hashMapSize);

        this.kernels.applyElemPass = Fn(()=>{
            this.hashBuffer.setAtomic(false);
            If(instanceIndex.greaterThanEqual(this.uniforms.vertexCount), () => {
                Return();
            });
            const prevPosition = this.prevPositionBuffer.element(instanceIndex).toVar();
            const influencerPtr = this.influencerPtrBuffer.element(instanceIndex).toVar();
            const ptrStart = influencerPtr.x.toVar();
            const ptrEnd = ptrStart.add(influencerPtr.y).toVar();
            const position = vec3().toVar();
            const weight = float().toVar();
            Loop({ start: ptrStart, end: ptrEnd,  type: 'uint', condition: '<' }, ({ i })=>{
                const restPositionPtr = this.influencerBuffer.element(i);
                const restPosition = this.restPosesBuffer.element(restPositionPtr);
                position.addAssign(restPosition.xyz.mul(restPosition.w));
                weight.addAssign(restPosition.w);
            });
            position.divAssign(weight);
            //const currentPosition = this.positionBuffer.element(instanceIndex).toVar();


            this.prevPositionBuffer.element(instanceIndex).assign(position);

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


            this.positionBuffer.element(instanceIndex).assign(position);
        })().compute(this.vertexCount);

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
            const initialPosition = this.initialPositionBuffer.element(vertexId).mul(this.uniforms.resetScale).add(this.uniforms.resetOffset).toVar();
            this.positionBuffer.element(vertexId).assign(initialPosition);
            this.prevPositionBuffer.element(vertexId).assign(initialPosition.sub(this.uniforms.resetVelocity));
        })().compute(this.vertexCount);

        this.uniforms.resetTetStart = uniform(0, "uint");
        this.uniforms.resetTetCount = uniform(0, "uint");
        this.kernels.resetTets = Fn(() => {
            If(instanceIndex.greaterThanEqual(this.uniforms.resetTetCount), () => {
                Return();
            });
            const tetId = this.uniforms.resetTetStart.add(instanceIndex).toVar();
            const volume  = this.restVolumeBuffer.element(instanceIndex).toVar();

            // Gather this tetrahedron's 4 vertex positions
            const vertexIds = this.tetBuffer.element(tetId);
            const pos0 = this.initialPositionBuffer.element(vertexIds.x).mul(this.uniforms.resetScale).add(this.uniforms.resetOffset).toVar();
            const pos1 = this.initialPositionBuffer.element(vertexIds.y).mul(this.uniforms.resetScale).add(this.uniforms.resetOffset).toVar();
            const pos2 = this.initialPositionBuffer.element(vertexIds.z).mul(this.uniforms.resetScale).add(this.uniforms.resetOffset).toVar();
            const pos3 = this.initialPositionBuffer.element(vertexIds.w).mul(this.uniforms.resetScale).add(this.uniforms.resetOffset).toVar();

            this.restPosesBuffer.element(tetId.mul(4)).assign(vec4(pos0.xyz, volume));
            this.restPosesBuffer.element(tetId.mul(4).add(1)).assign(vec4(pos1.xyz, volume))
            this.restPosesBuffer.element(tetId.mul(4).add(2)).assign(vec4(pos2.xyz, volume))
            this.restPosesBuffer.element(tetId.mul(4).add(3)).assign(vec4(pos3.xyz, volume))

            this.quatsBuffer.element(tetId).assign(vec4(0,0,0,1));
        })().compute(this.tetCount);

        this.uniforms.mouseRayOrigin = uniform(new THREE.Vector3());
        this.uniforms.mouseRayDirection = uniform(new THREE.Vector3());
        this.kernels.applyMouseEvent = Fn(()=>{
            If(instanceIndex.greaterThanEqual(this.uniforms.vertexCount), () => {
                Return();
            });

            const { mouseRayOrigin, mouseRayDirection } = this.uniforms;
            const position = this.positionBuffer.element(instanceIndex).toVar();
            const prevPosition = this.prevPositionBuffer.element(instanceIndex);

            const dist = cross(mouseRayDirection, position.sub(mouseRayOrigin)).length()
            const force = dist.mul(0.3).oneMinus().max(0.0).pow(0.5);
            prevPosition.addAssign(vec3(0,-0.25,0).mul(force));
        })().compute(this.vertexCount);
        await this.renderer.computeAsync(this.kernels.applyMouseEvent); //call once to compile


        const centerVertexArray = new Uint32Array(this.objectData.map(d => d.centerVertex.id));
        this.centerVertexBuffer = instancedArray(centerVertexArray, 'uint');
        this.positionReadbackBuffer = instancedArray(new Float32Array(this.objects.length*3), 'vec3');
        this.kernels.readPositions = Fn(()=>{
            const centerVertex = this.centerVertexBuffer.element(instanceIndex);
            const position = this.positionBuffer.element(centerVertex);
            this.positionReadbackBuffer.element(instanceIndex).assign(position);
        })().compute(this.objects.length);

        this.uniforms.scales = uniformArray(new Array(this.objectData.length).fill(0), "float");

        const objectPromises = this.objects.map(object => object.bake(this));
        await Promise.all(objectPromises);
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
        this.frameNum++;

        if (this.frameNum % 50 === 0) {
            this.readPositions().then(() => {}); // no await to prevent blocking!
        }

        const { stepsPerSecond } = conf;
        const timePerStep = 1 / stepsPerSecond;

        interval = Math.max(Math.min(interval, 1/60), 0.0001);
        this.uniforms.dt.value = timePerStep;

        this.timeSinceLastStep += interval;

        for (let i=0; i<this.objects.length; i++) {
            const object = this.objects[i];
            this.uniforms.scales.array[i] = THREE.MathUtils.smoothstep(Math.min(object.age * 3, 1.0), 0, 1);
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
            //await this.renderer.computeAsync(this.kernels.fillHashMap);
            //await this.renderer.computeAsync(this.kernels.solveCollisionsVertex);
            //await this.renderer.computeAsync(this.kernels.copyPositions);
        }

        //await this.renderer.computeAsync(this.kernels.fillHashMap);

        //const hashMap = new Int32Array(await this.renderer.getArrayBufferAsync(this.hashBuffer.value));
        //console.log(hashMap);
        //const hashMap = new Int32Array(await this.renderer.getArrayBufferAsync(this.triangleBuffer.value));
        //console.log(hashMap);
        if (this.frameNum > 1) {
            //const hashMap = new Int32Array(await this.renderer.getArrayBufferAsync(this.initialTetPositionBuffer.value));
            //console.log(hashMap);
        }

        //await this.readPositions();

    }
}