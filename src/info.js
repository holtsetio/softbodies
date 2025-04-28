import {Pane} from 'tweakpane';
import * as InfodumpPlugin from 'tweakpane-plugin-infodump';

export class Info {
    constructor() {
        const container = document.createElement('div');
        document.body.appendChild(container);
        container.style.position = 'absolute';
        container.style.left = '8px';
        container.style.bottom = '8px';
        container.style.maxWidth = '512px';
        container.style.width = 'calc(100% - 16px)';

        const pane = new Pane({ container })
        pane.registerPlugin(InfodumpPlugin);
        this.pane = pane;

        const info = pane.addFolder({
            title: "info",
            expanded: true,
        });
        info.addBlade({
            view: "infodump",
            content: "Realtime Tetrahedral FEM Models in the Browser, using WebGPU and written in [ThreeJS](https://threejs.org) TSL. Based on the WebGL implementation in [TetSim](https://github.com/zalo/TetSim) by [Johnathon Selstad](https://github.com/zalo), upgraded to enable collisions.\n\n" +
                "[Skull model](https://sketchfab.com/3d-models/skull-b78e4e6b29b2430293edd9c99d88a64e) by [DJMaesen](https://sketchfab.com/bumstrum). " +
                "[Virus model](https://sketchfab.com/3d-models/corona-virus-2e7ffcc5d8df41bfa6f7ee666237757c) by [Refref1990](https://sketchfab.com/refref1990). " +
                "[HDRi background](https://polyhaven.com/a/autumn_field_puresky) by Jarod Guest and Sergej Majboroda on [Polyhaven.com](https://polyhaven.com). " +
                "[Rope texture](https://www.texturecan.com/details/424/) by [texturecan.com](https://texturecan.com).\n\n" +

                "[> Other experiments](https://holtsetio.com)",
            markdown: true,
        })
    }
}