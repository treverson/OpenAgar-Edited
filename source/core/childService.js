"use strict";
/*
    OpenAgar - Open source web game
    Copyright (C) 2016 Andrew S
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

module.exports = class childService {
    constructor(main, child) {


        this.child = child

        this.main = main;
        this.totalMass = 0;
        this.toSend = [];
        this.buf = 0;
        this.updHash = {};
        this.movHash = {};
        this.movCode = [];
        this.hash = [];
        this.events = {}
        this.lb = [];


    }

    init() {
        this.child.on(this.main.id, function (data) {

            this.onData(data)
        }.bind(this))
        this.send(0, {
            hello: "hello",
            config: this.main.getConfig(),
            teams: this.main.haveTeams,
            bounds: this.main.bounds
        })
        this.on('lb', function (lb) {
            this.lb = lb
        }.bind(this))
        this.on('mass', function (m) {
            var nodes = this.main.getWorld().getNodes('player'),
                max = this.main.getConfig().playerMaxMass,
                maxCells = this.main.getConfig().playerMaxCells,
                splitSpeed = this.main.getConfig().splitSpeed,
                splitDecay = this.main.getConfig().splitDecay;
            m.forEach((k) => {
                var node = nodes.get(k)

                if (node) {
                    if (node.owner.cells.size >= maxCells) node.mass = Math.min(node.mass, max);
                    else this.main.splitPlayerCell(node, Math.random() * 6.28, splitSpeed, splitDecay)
                    node.updCode()
                }
            })
        }.bind(this))
        this.on('totmass', function (m) {
            this.totalMass = m;
        }.bind(this))
        this.on('lag', function (lag) {
            this.main.debug("yel{[Debug]} Lag detected for child ".styleMe() + this.child.id + " Latency: " + lag)
        }.bind(this))
    }
    pause(state) {
        this.send(9, {
            p: state
        })

    }
    on(e, f) {
        this.events[e] = f
    }
    emit(e, d) {
        this.send(7, {
            e: e,
            d: d
        })
    }
    clearEvents() {
        this.events = {}
    }
    action(bot, action, data) {
        switch (action) {
        case 1: // spawn
            bot.onSpawn()
            this.main.spawn(bot)

            break;
        case 2: // eject
            this.main.ejectMass(bot)
            break;
        case 3: // split
            this.main.splitPlayer(bot)
            break;
        }
    }
    event(event, data) {
        if (this.events[event]) this.events[event](data)
    }

    onData(data) {
        if (this.main.destroyed) return
        if (data.p) {

            var world = this.main.getWorld().getNodes('map')
            data.d.forEach((c) => {
                var cell = world.get(c.i)
                if (!cell) return;
                cell.nearby = []
                c.l.forEach((n) => {

                    var node = world.get(n)

                    if (node) cell.nearby.push(node)
                })
            })
            return;
        }


        // console.log(data)
        data.forEach((bot) => {
            if (bot.e) {
                this.event(bot.e, bot.d)
            } else
            if (bot.action) {
                var b = this.main.bots.get(bot.id)
                if (!b) return
                this.action(b, bot.action, bot)
            } else {
                var b = this.main.bots.get(bot.i)
                if (!b) return
                b.mouse.x = bot.m.x
                b.mouse.y = bot.m.y
            }
        })
    }
    stop() {
        this.child.removeListener(this.main.id)
        delete this.child

    }
    send(type, data) {
        data.type = type;
        try {
            this.child.send(this.main.id, data)
        } catch (e) {

        }
    }
    addBot(bot) {

        this.send(5, {
            id: bot.id,
            bot: bot.botid
        })
    }
    removeClient(client) {
        this.emit('delPlayer', client.id)
    }
    addNode(node) {

        if (this.hash[node.id]) return;
        this.toSend.push({
            id: node.id,
            size: node.size,
            type: node.type,
            position: node.position,
            owner: (node.owner) ? node.owner.id : false,
            mass: node.mass,
            speed: node.speed


        })
        this.hash[node.id] = true;

    }
    deleteNodes(nodes) {
        if (nodes[0])
            this.send(2, {
                nodes: nodes
            })

    }
    sendMove(node) {
        this.movCode.push({
            id: node.id,
            x: node.position.x,
            y: node.position.y
        })

    }
    update() {
        if (this.main.lag > 0) {
            if (this.buf > 5) {
                this.buf = 0

            } else {
                this.buf++;
            }
        }

        var nodes = this.main.getWorld().getNodes('player')

        nodes.forEach((node) => {

            if (node.updateCode != this.updHash[node.id]) {
                this.hash[node.id] = false;
                this.updHash[node.id] = node.updateCode
                this.addNode(node)
            } else if (node.moveCode != this.movHash[node.id]) {

                this.movHash[node.id] = node.moveCode
                this.movCode.push({
                    id: node.id,
                    x: node.position.x,
                    y: node.position.y
                })
            }

        })
        if (this.movCode[0]) this.send(3, {
            nodes: this.movCode
        })
        this.movCode = [];

    }

    sendNodes() {
        if (this.toSend.length == 0) return
        this.send(1, {
            nodes: this.toSend
        })

        this.toSend = [];
    }

}