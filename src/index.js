const http = require('http');
const express = require('express');
const socketIo = require('socket.io');
const OBSWebSocket = require('obs-websocket-js');
const { send } = require('process');

/*
    Below are configuration variables, to be customized to suit your needs
*/

const active_state = 'expanded'; // name of the filter to activate when they are talking
const inactive_state = 'normal'; // name of filter when not talking
const quiet_time = 4000; // how long input is quiet before switching to inactive state
const interval_period = 150; // how often to run the changeScene function
const websocket_host = 'localhost' // address of machine running obs with websocket plugin
const websocket_port = 4444; // port where obs websocket plugin is running
const websocket_password = 'secret'; // password for websocket
const webserver_port = 3000; // port to serve the http gui

/*
    End configuration variables, do not edit below here
*/


const obs = new OBSWebSocket();
obs.connect({ address: websocket_host + ':' + websocket_port, password: websocket_password });

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('./public'));

//Convert this in iterables and dynamic elemnts
slave1 = {}
slave2 = {}
slave3 = {}
slave4 = {}
slave5 = {}
master = {}

// this tracks how many milliseconds since the indicated source went quiet, aka dropped below the threshold for activation/expansion
state_tracker_quiet = {};

// track current state of source, so we dont have to keep sending signals all the time flooding the ws connection
state_tracker_state = {};

io.on('connection', (socket) => {
    socket.on('audioInput', (body) => {
        setValues({ 'volume': parseInt(body.volume), 'id': body.id, 'scene': body.scene, 'limit': parseInt(body.limit)})
        //console.log({ 'volume': parseInt(body.volume), 'id': body.id, 'scene': body.scene, 'limit': parseInt(body.limit)})
    });
});

function setValues(val) {
    if (val.id == "slave-1") {
        slave1 = val
    }
    if (val.id == "slave-2") {
        slave2 = val
    }
    if (val.id == "slave-3") {
        slave3 = val
    }
    if (val.id == "slave-4") {
        slave4 = val
    }
    if (val.id == "slave-5") {
        slave5 = val
    }
    if (val.id == "master") {
        master = val
    }
}

function sendOBSSourceFilterMessage(source_name, target_state) {
    try {
        obs.send('SetSourceFilterVisibility', {'sourceName': source_name, 'filterName': target_state, 'filterEnabled': true});
    } catch {
        console.warn('failure sending obs source filter message');
    }
}

function setActive(source_name) {
    // send active state signal
    if (!(source_name in state_tracker_state)) {
        // no state info, lets default it to inactive and then do nothing
        state_tracker_state[source_name] = 'inactive';
    } else {
        if (state_tracker_state[source_name] == 'inactive'){
            sendOBSSourceFilterMessage(source_name, active_state);
            state_tracker_quiet[source_name] = 0;
            state_tracker_state[source_name] = 'active';
        }
    }
    
}

function setQuiet(source_name) {
    // Quiet, but not neccesarily inactive yet
    if (state_tracker_quiet[source_name] > quiet_time) {
        setInactive(source_name);
    } else {
        var prior_quiet_value = state_tracker_quiet[source_name];
        state_tracker_quiet[source_name] = prior_quiet_value + interval_period;
    }
}

function setInactive(source_name) {
    // send inactive state signal
    if (!(source_name in state_tracker_state)) {
        // no state info, lets default it to inactive and then do nothing
        state_tracker_state[source_name] = 'inactive';
    } else {
        if (state_tracker_state[source_name] == 'active'){
            sendOBSSourceFilterMessage(source_name, inactive_state);
            state_tracker_quiet[source_name] = 0;
            state_tracker_state[source_name] = 'inactive';
        }
    }
}

function changeScene() {
        if (master.volume > parseInt(master.limit)) {
            setActive('master');
        } else {
            setQuiet('master');
        }

        if (slave1.volume > parseInt(slave1.limit)) {
            setActive('slave1');
        } else {
            setQuiet('slave1');
        }

        if (slave2.volume > parseInt(slave2.limit)) {
            setActive('slave2');
        } else {
            setQuiet('slave2');
        }

        if (slave3.volume > parseInt(slave3.limit)) {
            setActive('slave3');
        } else {
            setQuiet('slave3');
        }

        if (slave4.volume > parseInt(slave4.limit)) {
            setActive('slave4');
        } else {
            setQuiet('slave4');
        }

        if (slave5.volume > parseInt(slave5.limit)) {
            setActive('slave5');
        } else {
            setQuiet('slave5');
        }
}

setInterval(() => {
    try {
        changeScene();
    } catch {
        console.warn('changeScene threw an exception')
    }
}, interval_period);

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason.stack);
    // application specific logging, throwing an error, or other logic here
  });

server.listen(webserver_port, () => {
    console.log('OBS Audio Switch is now running on port ' + webserver_port)
    console.log('')
});