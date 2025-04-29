import {atomicFunc, Fn, instancedArray, instanceIndex, ivec3, uvec3, uint, int, float} from "three/tsl";
import {murmurHash13} from "./math.js";

export class Grid {
    cellsize = 1;
    type = "";
    buffer = null;

    constructor(cellsize, type = "basic") {
        this.cellsize = cellsize;
        this.type = type;

        if (type === "basic") {
            this.gridsize1d = 80;
            this.gridsize = this.gridsize1d * this.gridsize1d * this.gridsize1d;
        } else if (type === "hash") {
            this.gridsize = 1048573; // biggest prime below 2^20
        } else {
            console.error("Unrecognized grid type");
        }

        this.buffer = instancedArray(this.gridsize, "int").toAtomic();

        this.clearKernel = Fn(() => {
            this.buffer.setAtomic(false);
            this.buffer.element(instanceIndex).assign(int(-1));
        })().compute(this.gridsize);

    }

    async clearBuffer(renderer) {
        await renderer.computeAsync(this.clearKernel);
    }

    getElementFromIndex(ipos) {
        if (this.type === "basic") {
            const upos = uvec3(ipos.add(1073741823)).mod(this.gridsize1d).toVar();
            const hash = upos.x.mul(this.gridsize1d*this.gridsize1d).add(upos.y.mul(this.gridsize1d)).add(upos.z).mod(this.gridsize).toVar("hash");
            return this.buffer.element(hash);
        } else if (this.type === "hash") {
            const hash = murmurHash13(ipos).mod(uint(this.gridsize)).toVar("hash");
            return this.buffer.element(hash);
        }
    }

    getElement(pos) {
        const ipos = ivec3(pos.div(this.cellsize).floor());
        return this.getElementFromIndex(ipos);
    }

    setAtomic(value) {
        this.buffer.setAtomic(value);
    }
}