import * as THREE from "three/webgpu";
import { attributeArray, instancedArray } from "three/tsl";

export class WgpuBuffer {
    name = "";
    typeclass = null;
    array = null;
    buffer = null;
    constructor(_length, _wgputype, _itemsize, _typeclass = Float32Array, _name = "", instanced = false) {
        this.typeclass = _typeclass;
        this.array = new this.typeclass(_length * _itemsize);
        if (instanced) {
            this.buffer = instancedArray(this.array, _wgputype).label(_name);
        } else {
            this.buffer = attributeArray(this.array, _wgputype).label(_name);
        }
    }
    async read(renderer) {
        return new this.typeclass(await renderer.getArrayBufferAsync(this.buffer));
    }
    get buffer() {
        return this.buffer;
    }
}