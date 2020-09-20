const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// const simConnect = require('../Projects/bitlgx/ocars/node_modules/node-simconnect');
const simConnect = require('../Projects/node-simconnect-master');

const pullData = (data, fn, ...flags) => simConnect.requestDataOnSimObject(
  Object.entries(data).map(([key, value]) => {
    if (typeof value === 'number') {
      // special data type
      return [key, null, value];
    }
    return [key, value];
  }), (resp) => {
    fn(resp);
  }, ...flags,
);

const formatVars = (entries) => {
  const spacedVars = {};
  Object.entries(entries).forEach(([key, value]) => {
    const spacedKey = key
      .replace(/[A-Z]/g, (match) => ` ${match}`)
      .toUpperCase();

    if (/string|int|float/i.test(value)) {
      // this is a non default data type
      spacedVars[spacedKey] = simConnect.datatype[value.toUpperCase()];
    } else {
      spacedVars[spacedKey] = value;
    }
  });

  return spacedVars;
};

function connectToSim() {
  const success = simConnect.open('MyAppName',
    (name, version) => {
      console.log(`Connected to: ${name}\nSimConnect version: ${version}`);

      io.on('connection', (socket) => {
        // console.log('connected');
        socket.emit('connected', true);
        socket.on('request', ({ vars, frequency = false, events }) => {
          const spacedVars = formatVars(vars);

          const doDataPull = (fn) => {
            pullData(
              spacedVars,
              (resp) => { fn(resp); },
              simConnect.objectId.USER, // User aircraft
              simConnect.period.SIM_FRAME, // Get data every sim frame...
              simConnect.dataRequestFlag.CHANGED,
            );
          };

          events.forEach((e) => {
            if (e === 'landed') {
              let count = 0;
              let oldValue;
              doDataPull((resp) => {
                if (count < 1) {
                  oldValue = resp['SIM ON GROUND'];
                }
                count += 1;
                if (resp['SIM ON GROUND'] === 1 && oldValue === 0) {
                  socket.emit('landed', resp);
                  oldValue = 1;
                } else {
                  oldValue = resp['SIM ON GROUND'];
                }
              });
            } else if (e === 'tookOff') {
              let count = 0;
              let oldValue;
              doDataPull((resp) => {
                if (count < 1) {
                  oldValue = resp['SIM ON GROUND'];
                }
                count += 1;
                if (resp['SIM ON GROUND'] === 0 && oldValue === 1) {
                  socket.emit('tookOff', resp);
                  oldValue = 0;
                } else {
                  oldValue = resp['SIM ON GROUND'];
                }
              });
            }
          });

          if (frequency) {
            let state = {};
            doDataPull((resp) => { state = resp; });
            setInterval(() => {
              socket.emit('update', state);
            }, frequency);
          } else {
            doDataPull((resp) => { socket.emit('update', resp); });
          }
        });
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
