import {Pane} from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import mobile from "is-mobile";

const isMobile = mobile();

class Conf {
    gui = null;

    wireframe = false;

    stepsPerSecond = 180;

    bodies = (isMobile ? 30 : 100);

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

        const scenes = {
            mixed: { min: 10, max: 300, default: 100, text: "mixed" },
            spheres: { min: 10, max: 200, default: 50, text: "only spheres" },
            skulls: { min: 10, max: 200, default: 50, text: "only skulls" },
            ropes: { min: 30, max: 500, default: 100, text: "only ropes" },
            longropes: { min: 3, max: 100, default: 10, text: "looooong ropes" },
        };

        settings.addBlade({
            view: 'list',
            label: 'scene',
            options: Object.keys(scenes).map(key => ({ ...scenes[key], value: key })),
            value: 'mixed',
        }).on('change', (ev) => {
            const params = scenes[ev.value];
            this.bodies = Math.round(params.default * (isMobile ? 0.3 : 1.0));
            this.maxBodies = params.max;
            this.bodiesBinding.min = params.min;
            this.bodiesBinding.max = params.max;
            this.scene = ev.value;
            gui.refresh();
        });

        this.bodiesBinding = settings.addBinding(this, "bodies", { min: 20, max: this.maxBodies, step: 10 });
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