import * as THREE from "three/webgpu";
import {If, length, max, min, mod, round, time, vec2, vec3, vec4} from "three/tsl";
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
        this.createWallGeometry();
        this.createZWallGeometry();
        this.createCapsuleGeometry();
        //this.createBoxGeometry();

    }

    createCollider() {

    }

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

    createFloorGeometry() {
        const floorPosition = -17.5;
        const geometry = new THREE.PlaneGeometry(100,100,1,1);
        const material = new THREE.MeshPhysicalNodeMaterial({ color: 0xffffff });
        const floor = new THREE.Mesh(geometry, material);
        floor.rotation.set(-Math.PI * 0.5, 0, 0);
        floor.position.setY(floorPosition);

        const slope = 0.5;
        const collider = (positionImmutable) => {
            const dist = positionImmutable.y.sub(floorPosition);
            const normal = vec3(0,1,0).normalize();
            return vec4(normal, dist);
            /*const normal = vec3(positionImmutable.x.sign().mul(slope),1,0).normalize();
            const dist = positionImmutable.y.sub(positionImmutable.x.abs().mul(slope).negate().add(floorPosition));
            return vec4(normal, dist);*/
        };
        this.physics.addCollider(collider);

        this.object.add(floor);
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
