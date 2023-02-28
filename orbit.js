/* gravitational constant */
const G = 6.67 * Math.pow(10, -11);

/* graphics scaling helper */
const scale = (n) => n == 0 ? 1 : Math.pow(10, Math.floor(Math.log10(Math.abs(n))));

class PhysicsBody {
    /* represents a physical entity */
    constructor(p, {
        name="[Unnamed]",
        x=0, y=0, vx=0, vy=0, ax=0, ay=0,
        fx=0, fy=0, r=0, m=1,
        rigid=false, color="black",
        tracking=false,
    }) {
        this.p = p;
        this.name = name;
        this.pos = p.createVector(x, y);
        this.vel = p.createVector(vx, vy);
        this.acc = p.createVector(ax, ay);
        this.f = p.createVector(fx, fy);
        this.lf = p.createVector(0, 0);
        this.r = r;
        this.m = m;
        this.rigid = rigid;
        this.color = color;
        this.tracking = tracking;
        this.ticks = 0;
        this.past = [];
        this.ppos = [];
        this.pvel = [];
    }

    move(dt) {
        /* calculates acceleration, velocity, and position. saves old position */
        if (this.rigid) { return; }
        this.acc.set(this.f.copy().mult(1 / this.m));
        this.vel.add(this.acc.copy().mult(dt));
        this.pos.add(this.vel.copy().mult(dt));
        this.ppos.push(this.pos.copy());
        if (this.ppos.length > 1000) { this.ppos.shift(); }
    }

    display(center) {
        /* displays the entity at its current position, centered on another entity */
        let sx = this.p.width / 2 + ((this.pos.x - center.pos.x) / (3.84 * Math.pow(10, 8))) * 100;
        let sy = this.p.height / 2 + ((this.pos.y - center.pos.y) / (3.84 * Math.pow(10, 8))) * 100;
        let sr = this.r / scale(this.r) * 5;
        this.p.circle(sx, sy, sr);
        if (!this.rigid && this.tracking) {
            if (this.ticks % 15 == 0) { 
                this.past.push([sx, sy]);
                this.ticks = 1;
            }
            if (this.past.length > 10000) { this.past.shift(); }
            this.ticks += 1;
        }
    }
}

class World {
    /* represents a world with physical entities */
    constructor(p, {
        center = "",
        entities = [],
        gravity = false
    }) {
        this.p = p;
        this.center = center;
        this.entities = entities;
        this.gravity = gravity;
    }

    forces() {
        /* calculate forces for all entities */
        this.entities.forEach((entity, i) => {
            this.entities.forEach((entity2, i2) => {
                if (i < i2) {
                    const dx = entity2.pos.copy().sub(entity.pos);
                    const r = Math.max(dx.mag(), 1);
                    let f = (G * entity.m * entity2.m) / Math.pow(r, 2); 
                    let fv = this.p.createVector(f * dx.x / r, f * dx.y / r);
                    entity.f.add(fv);
                    entity2.f.sub(fv);
                }
            })
        })
    }

    force(entityName, fx, fy) {
        /* apply a force to an entity */
        let entity = this.entities.filter((e) => e.name == entityName)[0];
        entity.f.add(this.p.createVector(fx, fy));
    }

    move(dt) {
        /* move all entities */
        this.ticks += 1;

        if (this.gravity) {
            this.forces();
        }
        this.entities.forEach((entity) => {
            entity.move(dt);
            entity.lf.set(entity.f);
            entity.f.mult(0);
        })
    }

    display() {
        /* display all entities */
        let center = this.select(this.center);
        this.entities.forEach((e) => e.display(center));
    }

    select(name) {
        /* select an entity */
        return this.entities.filter((e) => e.name == name)[0] ?? null;
    }
}

/* global world object */
let world;

let orbit = function(p) {
    /* force timer */
    let force = [0, true];

    /* previous energies (for deltas) */
    let lke = 0;
    let lgpe = 0;

    /* apogee and perigee vectors */
    let apogees = [];
    let perigees = [];

    p.setup = function() {
        /* setup p5 and world */
        const div = document.querySelector("div#container");
        let canvas = p.createCanvas(
            div.offsetWidth - window.innerWidth * 0.4, 
            div.offsetHeight
        );
        canvas.parent("container");
        canvas.class("simulation");
        world = new World(p, {
            center: "Earth",
            entities: [
                new PhysicsBody(p, {
                    name: "Sun",
                    m: 1.989 * Math.pow(10, 30),
                    x: 1.496 * Math.pow(10, 11), y: 0,
                    r: 6.957 * Math.pow(10, 8),
                    rigid: false, color: "yellow"
                }),
                new PhysicsBody(p, {
                    name: "Earth",
                    m: 5.97 * Math.pow(10, 24),
                    x: 0, y: 0,
                    vx: 0, vy: -29780,
                    r: 6.378 * Math.pow(10, 6), 
                    rigid: false, color: "blue"
                }),
                new PhysicsBody(p, {
                    name: "Moon",
                    m: 7.348 * Math.pow(10, 22),
                    x: 3.84 * Math.pow(10, 8), y: 0,
                    vx: 0, vy: -1018.32-29780,
                    r: 1.7 * Math.pow(10, 6), 
                    rigid: false, color: "black",
                })
            ],
            gravity: true
        })
    }
    
    p.draw = function() {
        /* clear canvas */
        p.background(255);

        /* apply impact */
        if (force[0] > 2500 && force[1]) {
            world.force("Moon", -Math.pow(10, 21.75), Math.pow(10, 21.75));
            force[1] = false;

            /* begin tracking moon */
            world.select("Moon").tracking = true;
        } else {
            force[0] += p.deltaTime;
        }

        /* move and display entities */
        world.move(p.deltaTime * 200);
        world.display();

        /* fetch earth and moon */
        const earth = world.select("Earth");
        const moon = world.select("Moon");

        /* trace moon path */
        p.strokeWeight(1);
        p.noFill();
        p.beginShape();
        for (let i=0;i<moon.past.length;i++) {
            p.curveVertex(moon.past[i][0], moon.past[i][1]);
        }
        p.endShape();

        /* stats element helper */
        const ch = (s) => document.querySelector(`code#${s}`);

        /* calculate and display energy deltas */
        const mke = ((moon.m * moon.vel.copy().sub(earth.vel).magSq()) / 2);
        const mgpe = (-(G * earth.m * moon.m) / (moon.pos.copy().sub(earth.pos).mag()));
        ch("ke").innerHTML = (mke - lke).toExponential(3);
        ch("gpe").innerHTML = (mgpe - lgpe).toExponential(3);
        ch("te").innerHTML = ((mke - lke) + (lgpe - mgpe)).toExponential(3);
        lke = mke;
        lgpe = mgpe;

        /* calculate and display kinematic information */
        ch("rf").innerHTML = (moon.lf.copy().sub(earth.lf).mag()).toExponential(3);
        ch("rfx").innerHTML = moon.lf.x.toExponential(3);
        ch("rfy").innerHTML = (-moon.lf.y).toExponential(3);
        ch("racc").innerHTML = (moon.acc.copy().sub(earth.acc).mag()).toFixed(3);
        ch("rxacc").innerHTML = (moon.acc.x - earth.acc.x).toFixed(3);
        ch("ryacc").innerHTML = (-moon.acc.y + earth.acc.y).toFixed(3);
        ch("rvel").innerHTML = (moon.vel.copy().sub(earth.vel).mag()).toFixed(3);
        ch("rxvel").innerHTML = (moon.vel.x - earth.vel.x).toFixed(3);
        ch("ryvel").innerHTML = (-moon.vel.y + earth.vel.y).toFixed(3);
        ch("distance").innerHTML = moon.pos.copy().sub(earth.pos).mag().toExponential(3);

        /* calculate and display apsides */
        if (moon.ppos.length > 2 && earth.ppos.length > 2) {
            const one = moon.ppos[moon.ppos.length - 1].copy().sub(earth.ppos[earth.ppos.length - 1]);
            const two = moon.ppos[moon.ppos.length - 2].copy().sub(earth.ppos[earth.ppos.length - 2]);
            const three = moon.ppos[moon.ppos.length - 3].copy().sub(earth.ppos[earth.ppos.length - 3]);
            if ((one.mag() < two.mag()) && (two.mag() > three.mag())) {
                apogees.push(two);
                if (apogees.length > 1000) { apogees.shift(); }
            } else if ((one.mag() > two.mag()) && (two.mag() < three.mag())) {
                perigees.push(two);
                if (perigees.length > 1000) { perigees.shift(); }
            }
            if (apogees.length > 0 && perigees.length > 0) { 
                ch("apogee").innerHTML = apogees[apogees.length - 1].mag().toExponential(3);
                ch("perigee").innerHTML = perigees[perigees.length - 1].mag().toExponential(3);
                ch("tilt").innerHTML = (90 - Math.atan(Math.abs(perigees[perigees.length - 1].y / perigees[perigees.length - 1].x)) * (180 / Math.PI)).toFixed(3);
                ch("eccentricity").innerHTML = Math.sqrt(1 - (perigees[perigees.length - 1].mag() / apogees[apogees.length - 1].mag())).toFixed(3);
            }
        }

    }
}

/* magic */
let p5orbit = new p5(orbit);
