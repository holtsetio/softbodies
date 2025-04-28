import * as THREE from "three/webgpu";
import {
    vec3,
    vec4,
    Fn, smoothstep, positionView, positionWorld,
} from "three/tsl";

class CollisionGeometry {
    constructor(physics) {
        this.physics = physics;
        this.object = new THREE.Object3D();
    }

    async createGeometry() {
        const collider = (positionImmutable) => {
            const position = vec3(positionImmutable).toVar();
            //position.addAssign(vec3(0,-20,10));
            const normal = position.normalize();
            const length = position.length();
            const dist = length.sub(5); //float(25).sub(length).mul(step(100, length).oneMinus());
            return vec4( normal, dist );
        };
        this.physics.addCollider(collider);
        const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(5, 3), new THREE.MeshStandardNodeMaterial(
            {color: new THREE.Color(1,1,1), metalness: 0.1, roughness:0.8}
        ));
        ball.castShadow = true;
        ball.receiveShadow = true;
        this.object.add(ball);
    }

    update(delta, elapsed) {

    }

    dispose() {

    }
}
export default CollisionGeometry;
