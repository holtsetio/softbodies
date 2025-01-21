import * as THREE from "three/webgpu";
import {
    Fn,
    instancedArray,
    instanceIndex,
    float,
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
    normalize, Return, uniform, select, time
} from "three/tsl";
import {mx_perlin_noise_float} from "three/src/nodes/materialx/lib/mx_noise";

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

    oldrestingPoses = [];

    vertexCount = 0;

    tetCount = 0;

    density = 1000;

    kernels = {};

    uniforms = {};

    time = 0;

    constructor(renderer) {
        this.renderer = renderer;
    }

    addVertex(x,y,z) {
        const id = this.vertexCount;
        const vertex = {x,y,z,id,influencers: [], triangles: []};
        this.vertices.push(vertex);
        this.vertexCount++;
        return vertex;
    }

    addTet(v0,v1,v2,v3) {
        const id = this.tetCount;
        const tet = {id,v0,v1,v2,v3};
        this.tets.push(tet);
        v0.influencers.push(id * 4 + 0);
        v1.influencers.push(id * 4 + 1);
        v2.influencers.push(id * 4 + 2);
        v3.influencers.push(id * 4 + 3);
        this.tetCount++;
        return tet;
    }

    bake() {
        console.log(this.vertexCount + " vertices");
        console.log(this.tetCount + " tetrahedrons");
        const oldrestingPose = new THREE.Matrix3();
        const invRestVolume = new Array(this.tetCount).fill(0);
        const invMass = new Array(this.vertexCount).fill(0.0);
        const vel0 = new Array(this.vertexCount*3).fill(0.0);
        const quats0 = new Array(this.tetCount*4).fill(0.0);
        const restPoses = new Array(this.tetCount*4*4).fill(0);

        this.tets.forEach((tet,index) => {
            const { v0, v1, v2, v3 } = tet;
            [v0, v1, v2, v3].forEach((vertex,subindex) => {
                restPoses[(index*4+subindex)*4 + 0] = vertex.x;
                restPoses[(index*4+subindex)*4 + 1] = vertex.y;
                restPoses[(index*4+subindex)*4 + 2] = vertex.z;
                restPoses[(index*4+subindex)*4 + 3] = 0;
            });

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
            invMass[v0.id] += pm;
            invMass[v1.id] += pm;
            invMass[v2.id] += pm;
            invMass[v3.id] += pm;
            invRestVolume[index] = 1/V;
            quats0[index*4+0] = 0;
            quats0[index*4+1] = 0;
            quats0[index*4+2] = 0;
            quats0[index*4+3] = 1;
        });

        const vertexArray = new Float32Array(this.vertexCount * 3);
        const influencerPtrArray = new Uint32Array(this.vertexCount * 2); // x: ptr, y: length
        const influencerArray = new Uint32Array(this.tetCount * 4);
        let influencerPtr = 0;
        this.vertices.forEach((vertex, index) => {
            vertexArray[index*3+0] = vertex.x * 1.0;// + Math.random() * 0.001;
            vertexArray[index*3+1] = vertex.y * 1.0;// + Math.random() * 0.001;
            vertexArray[index*3+2] = vertex.z * 1.0;// + Math.random() * 0.001;
            influencerPtrArray[index * 2 + 0] = influencerPtr;
            influencerPtrArray[index * 2 + 1] = vertex.influencers.length;
            vertex.influencers.forEach(influencer => {
                influencerArray[influencerPtr] = influencer;
                influencerPtr++;
            });
            if (invMass[index] !== 0.0) {
                invMass[index] = 1 / invMass[index];
            }
        });


        const tetArray = new Int32Array(this.tetCount * 4);
        this.tets.forEach((tet,index) => {
            const { v0,v1,v2,v3 } = tet;
            tetArray[index*4+0] = v0.id;
            tetArray[index*4+1] = v1.id;
            tetArray[index*4+2] = v2.id;
            tetArray[index*4+3] = v3.id;
        });

        const restPosesArray = new Float32Array(restPoses);
        const quatsArray = new Float32Array(quats0);
        const invMassArray = new Float32Array(invMass);
        const invRestVolumeArray = new Float32Array(invRestVolume);
        const velocityArray = new Float32Array(vel0);

        this.vertexBuffer = instancedArray(vertexArray, 'vec3');
        this.influencerPtrBuffer = instancedArray(influencerPtrArray, 'uvec2');
        this.influencerBuffer = instancedArray(influencerArray, 'uint');
        this.tetBuffer = instancedArray(tetArray, 'ivec4');
        this.restPosesBuffer = instancedArray(restPosesArray, 'vec4');
        this.quatsBuffer = instancedArray(quatsArray, 'vec4');
        this.invMassBuffer = instancedArray(invMassArray, 'float');
        this.invRestVolumeBuffer = instancedArray(invRestVolumeArray, 'float');
        this.velocityBuffer = instancedArray(velocityArray, 'vec3');

        this.uniforms.vertexCount = uniform(this.vertexCount, "int");
        this.uniforms.tetCount = uniform(this.tetCount, "int");
        this.uniforms.time = uniform(0, "float");

        this.kernels.solveElemPass = Fn(() => {
            If(instanceIndex.greaterThanEqual(this.uniforms.tetCount), () => {
                Return();
            });
            // Gather this tetrahedron's 4 vertex positions
            const vertexIds = this.tetBuffer.element(instanceIndex);
            const pos0 = this.vertexBuffer.element(vertexIds.x).toVar();
            const pos1 = this.vertexBuffer.element(vertexIds.y).toVar();
            const pos2 = this.vertexBuffer.element(vertexIds.z).toVar();
            const pos3 = this.vertexBuffer.element(vertexIds.w).toVar();

            // The Reference Rest Pose Positions
            // These are the same as the resting pose, but they're already pre-rotated
            // to a good approximation of the current pose
            const ref0 = this.restPosesBuffer.element(instanceIndex.mul(4)).xyz.toVar();
            const ref1 = this.restPosesBuffer.element(instanceIndex.mul(4).add(1)).xyz.toVar();
            const ref2 = this.restPosesBuffer.element(instanceIndex.mul(4).add(2)).xyz.toVar();
            const ref3 = this.restPosesBuffer.element(instanceIndex.mul(4).add(3)).xyz.toVar();

            // Get the centroids
            const curCentroid = pos0.add(pos1).add(pos2).add(pos3).mul(0.25);
            const lastRestCentroid = ref0.add(ref1).add(ref2).add(ref3).mul(0.25);

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
            const rotation = extractRotation(covariance, vec4(0.0, 0.0, 0.0, 1.0));

            // Write out the undeformed tetrahedron
            const prevQuat = this.quatsBuffer.element(instanceIndex).toVar();
            const newQuat = normalize(quat_mult(rotation, prevQuat)); // Keep track of the current Quaternion for normals
            this.quatsBuffer.element(instanceIndex).assign(newQuat);

            const invVolume  = float(1.0).div(this.invRestVolumeBuffer.element(instanceIndex));
            const relativeQuat = normalize(quat_mult(newQuat, quat_conj(prevQuat)));

            // Rotate the undeformed tetrahedron by the deformed's rotation
            ref0.assign(Rotate(ref0, relativeQuat).add(curCentroid));
            ref1.assign(Rotate(ref1, relativeQuat).add(curCentroid));
            ref2.assign(Rotate(ref2, relativeQuat).add(curCentroid));
            ref3.assign(Rotate(ref3, relativeQuat).add(curCentroid));

            this.restPosesBuffer.element(instanceIndex.mul(4)).assign(vec4(ref0, invVolume));
            this.restPosesBuffer.element(instanceIndex.mul(4).add(1)).assign(vec4(ref1, invVolume));
            this.restPosesBuffer.element(instanceIndex.mul(4).add(2)).assign(vec4(ref2, invVolume));
            this.restPosesBuffer.element(instanceIndex.mul(4).add(3)).assign(vec4(ref3, invVolume));

        })().compute(this.tetCount);

        this.kernels.applyElemPass = Fn(()=>{
            If(instanceIndex.greaterThanEqual(this.uniforms.vertexCount), () => {
                Return();
            });
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
            const oldPosition = this.vertexBuffer.element(instanceIndex);
            const delta = position.sub(oldPosition);

            const gravity = vec3(0,-9.81/10000,0);
            const velocity = this.velocityBuffer.element(instanceIndex).toVar();

            velocity.mulAssign(0.980).addAssign(delta.mul(0.99999)).addAssign(gravity);

            const projectedPosition = oldPosition.add(velocity);
            //const noise = mx_perlin_noise_float(vec3(projectedPosition.xz.mul(0.3), this.uniforms.time.mul(0.1)));
            const planePosition = float(-5).add(this.uniforms.time.mul(2).mod(6.0)); //sin(this.uniforms.time.mul(3)).mul(2.5).sub(5.5);
            If(projectedPosition.y.lessThan(planePosition), () => {
                velocity.y.subAssign(projectedPosition.y.sub(planePosition));
            });
            this.velocityBuffer.element(instanceIndex).assign(velocity);

            //this.vertexBuffer.element(instanceIndex).assign(oldPosition.add(delta.mul(2)));
        })().compute(this.vertexCount);

        this.kernels.applyForcesPass = Fn(()=>{
            If(instanceIndex.greaterThanEqual(this.uniforms.vertexCount), () => {
                Return();
            });
            const force = this.velocityBuffer.element(instanceIndex); //.addAssign(delta);
            this.vertexBuffer.element(instanceIndex).addAssign(force);
        })().compute(this.vertexCount);

    }

    async update(interval, elapsed) {
        interval = Math.min(interval, 1/60);
        const steps = 5;
        const dt = interval / steps;

        for (let i=0; i<steps; i++) {
            this.time += dt;
            this.uniforms.time.value = this.time;
            await this.renderer.computeAsync(this.kernels.solveElemPass);
            await this.renderer.computeAsync(this.kernels.applyElemPass);
            await this.renderer.computeAsync(this.kernels.applyForcesPass);
        }
    }
}