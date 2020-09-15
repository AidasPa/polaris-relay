const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// const simConnect = require('../Projects/bitlgx/ocars/node_modules/node-simconnect');
const simConnect = require('../Projects/node-simconnect-master');

const pullData = (data, fn, ...flags) => simConnect.requestDataOnSimObject(
  Object.entries(data), (resp) => {
    fn(resp);
  }, ...flags,
);

function connectToSim() {
  const success = simConnect.open('MyAppName',
    (name, version) => {
      console.log(`Connected to: ${name}\nSimConnect version: ${version}`);

      io.on('connection', (socket) => {
        // let frequency;
        // let requestVars;

        // socket.on('setUpdateFrequency', (interval) => {
        //   frequency = interval;
        // });
        socket.on('request', ({ vars, frequency = false }) => {
          const spacedVars = {};
          console.log(spacedVars, frequency);
          Object.entries(vars).forEach(([key, value]) => {
            const spacedKey = key
              .replace(/[A-Z]/g, (match) => ` ${match}`)
              .toUpperCase();
            spacedVars[spacedKey] = value;
          });
          if (frequency) {
            let state = {};
            pullData(
              spacedVars,
              (resp) => { state = resp; },
              simConnect.objectId.USER, // User aircraft
              simConnect.period.SIM_FRAME, // Get data every sim frame...
              simConnect.dataRequestFlag.CHANGED,
            );
            setInterval(() => {
              socket.emit('update', state);
            }, frequency);
          } else {
            pullData(
              spacedVars,
              (resp) => socket.emit('update', resp),
              simConnect.objectId.USER, // User aircraft
              simConnect.period.ONCE, // Get data every sim frame...
              simConnect.dataRequestFlag.CHANGED,
            );
          }
        });
        // socket.on('start', (fn) => {

        // });
      });
    }, () => {
      console.log('Simulator exited by user');
    }, (exception) => {
      console.log(`SimConnect exception: ${exception.name} (${exception.dwException}, ${exception.dwSendID}, ${exception.dwIndex}, ${exception.cbData})`);
    }, (error) => {
      console.log(`Undexpected disconnect/error: ${error}`); // Look up error code in ntstatus.h for details
    });

  if (!success) {
    setTimeout(() => {
      connectToSim();
    }, 5000);
  }
}

connectToSim();

http.listen(3030, () => {
  console.log('listening on 3030');
});
