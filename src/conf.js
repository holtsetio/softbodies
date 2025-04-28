import {Pane} from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';

class Conf {
    gui = null;

    wireframe = false;

    stepsPerSecond = 120;

    bodies = 100;

    maxBodies = 300;

    scene = 'mixed';

    constructor() {

    }

    init() {
        const gui = new Pane()
        gui.registerPlugin(EssentialsPlugin);

        const stats = gui.addFolder({
            title: "stats",
            expanded: false,
        });
        this.fpsGraph = stats.addBlade({
            view: 'fpsgraph',
            label: 'fps',
            rows: 2,
        });

        const settings = gui.addFolder({
            title: "settings",
            expanded: false,
        });

        settings.addBlade({
            view: 'list',
            label: 'scene',
            options: [
                //'lol'
                {text: 'mixed', value: 'mixed', max: 123},
                {text: 'only Spheres', value: 'spheres'},
                {text: 'only Skulls', value: 'skulls'},
                {text: 'only Ropes', value: 'ropes'},
                {text: 'looooong Ropes', value: 'longropes'},
            ],
            value: 'mixed',
        }).on('change', (ev) => {
            //console.log(ev);
            this.scene = ev.value;
        });

        settings.addBinding(this, "bodies", { min: 20, max: this.maxBodies, step: 10 });
        settings.addBinding(this, "stepsPerSecond", { min: 120, max: 300, step: 60 });
        //settings.addBinding(this, "wireframe");

        this.settings = settings;
        this.gui = gui;
    }

    update() {
    }

    begin() {
        this.fpsGraph.begin();
    }
    end() {
        this.fpsGraph.end();
    }
}
export const conf = new Conf();