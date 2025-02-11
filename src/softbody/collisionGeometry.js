import * as THREE from "three/webgpu";
import {
    float,
    If,
    length,
    max,
    min,
    mod,
    normalize,
    round,
    sub,
    time,
    vec2,
    vec3,
    vec4,
    floor,
    Fn,
    attribute,
    varying, transformNormalToView
} from "three/tsl";
import {RoundedBoxGeometry} from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

class Plane {
    constructor() {

    }
}

class CollisionGeometry {
    constructor(physics) {
        this.physics = physics;
        this.object = new THREE.Object3D();
        this.createFloorGeometry();
        //this.createBoxGeometry();

    }

    createCollider() {

    }
/*
    createBoxGeometry() {
        const width = 30;
        const height = 30;

        const geometry = new RoundedBoxGeometry(width,height,1000,10,5);
        const material = new THREE.MeshPhysicalNodeMaterial({ color: 0xffffff, side: THREE.BackSide });
        const box = new THREE.Mesh(geometry, material);
        this.object.add(box);

    }

    createCapsuleGeometry() {
        const repeat = 2.5;
        const radius = 0.5;
        const geometry = new THREE.CapsuleGeometry( radius, 3, 8, 16 );
        const material = new THREE.MeshPhysicalNodeMaterial({ color: 0xffffff });
        const capsule = new THREE.Mesh( geometry, material );
        capsule.rotation.set(Math.PI * 0.5, 0, 0);

        for (let y = 0; y < 6; y++) {
            const rowsize = y+1; //y === 0 ? 1 : (y % 2 ? 2 : 3);
            for (let x = 0; x < rowsize; x++) {
                const px = ((x*2) - rowsize + 1) * repeat;
                const py = -y * repeat;
                const tCapsule = capsule.clone();
                tCapsule.position.set(px,py,0);
                this.object.add(tCapsule);
            }
        }

        const collider = (positionImmutable) => {
            const sdCylinder = (p, c, r) => { return length(p.xy.sub(c.xy)).sub(r); }
            const repeatNode = vec2(repeat*2, repeat);
            const position = vec3(positionImmutable).toVar();
            position.y.assign(position.y.clamp(-(repeat * 5 + 1 ), 1));
            position.x.addAssign(round(position.y.div(repeatNode.y)).mul(repeatNode.x.mul(0.5)));
            position.xy.assign(mod(position.xy.add(repeatNode.mul(0.5)), repeatNode).sub(repeatNode.mul(0.5)));
            const dist = sdCylinder(position.xy, vec2(0,0), radius);
            const normal = vec3(position.xy, 0);
            return vec4(normal, dist);
        };
        this.physics.addCollider(collider);

    }
*/
    createFloorGeometry() {

        const slope = 0.2;

        const steps = 10;
        const positionArray = [];
        const sideArray = [];
        const stepArray = [];
        const indices = [];
        let vertexId = 0;

        for (let i=0; i<steps; i++) {
            for (let x = 0; x<2;x++) {
                for (let y = 0; y<2;y++) {
                    const px = x * 2 - 1;
                    const py = 0;
                    const pz = y;
                    positionArray.push(pz,py,px);
                    sideArray.push(1);
                    stepArray.push(i);
                    vertexId++;
                }
            }
            indices.push(vertexId - 3, vertexId - 2, vertexId - 1);
            indices.push(vertexId - 2, vertexId - 3, vertexId - 4);

            for (let x = 0; x<2;x++) {
                for (let y = 0; y<2;y++) {
                    const px = x * 2 - 1;
                    const py = y;
                    const pz = 1;
                    positionArray.push(pz,py,px);
                    sideArray.push(0);
                    stepArray.push(i);
                    vertexId++;
                }
            }
            indices.push(vertexId - 3, vertexId - 2, vertexId - 1);
            indices.push(vertexId - 2, vertexId - 3, vertexId - 4);
        }
        const positionBuffer = new THREE.BufferAttribute(new Float32Array(positionArray), 3, false);
        const sideBuffer = new THREE.BufferAttribute(new Float32Array(sideArray), 1, false);
        const stepBuffer = new THREE.BufferAttribute(new Float32Array(stepArray), 1, false);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', positionBuffer);
        geometry.setAttribute('side', sideBuffer);
        geometry.setAttribute('step', stepBuffer);
        geometry.setIndex(indices);

        const material = new THREE.MeshPhysicalNodeMaterial({ color: 0xffffff });

        const vNormal = varying(vec3(0), "v_normalView");
        material.positionNode = Fn(() => {
            const stepSize = vec4(5, -3, 30, 1);
            const position = attribute('position').xyz;
            const step = attribute('step');
            const side = attribute('side');
            const result = position.xyz.mul(stepSize.xyz).toVar();
            result.xy.addAssign(stepSize.xy.mul(step));
            result.y.subAssign(position.x.mul(position.y.oneMinus()));

            const normal = vec3(side.mul(slope).add(side.oneMinus()), side, 0).normalize();
            vNormal.assign(transformNormalToView(normal));
            return result;
        })();

        material.normalNode = vNormal.normalize();


        const floor = new THREE.Mesh(geometry, material);
        floor.frustumCulled = false;
        this.object.add(floor);

        const collider = (positionImmutable) => {
            const position = vec3(positionImmutable).toVar();
            const posXDiv = position.x.mul(0.2);
            const posXFloor = posXDiv.floor();
            const floorPosition = float(0.0).sub(posXFloor.mul(2.0)).toVar();
            const normal = vec3(slope, 1, 0).normalize().toVar();
            const dist = position.y.sub(position.x.mul(slope).negate().add(floorPosition)).toVar();

            If( dist.lessThan( 0.0 ), () => {
                const wallDist = float(1).sub(posXDiv.sub(posXFloor)).negate().mul(2.0);
                If( wallDist.lessThan( 0.0 ).and( wallDist.greaterThan( dist ) ), () => {
                    dist.assign(wallDist);
                    normal.assign( vec3(1,0,0) );
                } );
            } );

            return vec4( normal, dist );
        };
        this.physics.addCollider(collider);
    }

    createWallGeometry() {
        const wallPosition = 20;
        /*const geometry = new THREE.PlaneGeometry(100,100,1,1);
        const material = new THREE.MeshPhysicalNodeMaterial({ color: 0xffffff });
        const floor = new THREE.Mesh(geometry, material);
        floor.rotation.set(-Math.PI * 0.5, 0, 0);
        floor.position.setY(floorPosition);*/

        const collider = (positionImmutable) => {
            /*const dist = positionImmutable.y.sub(floorPosition);
            const normal = vec3(0,1,0).normalize();
            return vec4(normal, dist);*/
            const normal = vec3(positionImmutable.x.sign().negate(),0,0);
            const dist = positionImmutable.x.abs().sub(wallPosition).negate();
            return vec4(normal, dist);
        };
        this.physics.addCollider(collider);

        //this.object.add(floor);
    }

    createZWallGeometry() {
        const wallPosition = 2;
        const collider = (positionImmutable) => {
            /*const dist = positionImmutable.y.sub(floorPosition);
            const normal = vec3(0,1,0).normalize();
            return vec4(normal, dist);*/
            const normal = vec3(0,0,positionImmutable.z.sign().negate());
            const dist = positionImmutable.z.abs().sub(wallPosition).negate();
            return vec4(normal, dist);
        };
        this.physics.addCollider(collider);
    }

    update(delta, elapsed) {

    }
}
export default CollisionGeometry;
