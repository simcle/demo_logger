const express = require('express');
const http = require('http');
const ModbusRTU = require('modbus-serial');
const axios = require('axios');
const socketio = require('socket.io');
const isOnlie = require('is-online');

const rtb = require('./rtb')
const logger = rtb.child('logger')
const young = rtb.child('young')

const app = express();
const server = http.createServer(app);
const io = socketio(server , {cors: {origin: '*', methods: ['*']}})


const path = __dirname + '/public';
app.use(express.static(path));
app.get('/*', (req, res) => {
    res.sendFile(path+ '/index.html')
})

// baca data dari muc & ultrasonic
const client = new ModbusRTU();
client.connectRTUBuffered('/dev/tty.usbserial-AB0MFUKA', {baudRate: 9600});
client.setTimeout(1000);

const metersIdList = [1,2,3];

let sensor = {
    ph: 0.00,
    temp: 0.00,
    cod: 0.00,
    tss: 0.00,
    nh3n: 0.00,
    rate: 0.00,
    level: 0.00
}
let wind = {
    speed: 0.00,
    direction: 0.00
}

const getMetersValue = async (meters) => {
    try{
        // get value of all meters
        for(let meter of meters) {
            // // output value to console
            // console.log(await getMeterValue(meter));
            await getMeterValue(meter);
            // wait 100ms before get another device
            await sleep(100);
	}
    } catch(e){
        // if error, handle them here (it should not)
        console.log(e)
    } finally {
        // after get all data from salve repeate it again
        setImmediate(() => {
            getMetersValue(metersIdList);
        })
    }
}

const getMeterValue = async (id) => {
    
    try {
        // set ID of slave
        await client.setID(id);
        // read the 1 registers starting at address 0 (first register)
        if(id == 1) {
            let val =  await client.readHoldingRegisters(0, 30);
            sensor.ph = val.buffer.swap16().readFloatLE().toFixed(2);
            sensor.temp = val.buffer.readFloatLE(4).toFixed(2);
            sensor.cod = val.buffer.readFloatLE(32).toFixed(2);
            sensor.tss = val.buffer.readFloatLE(40).toFixed(2);
            sensor.nh3n = val.buffer.readFloatLE(48).toFixed(2);
        }
        if(id == 2) {
            let val =  await client.readHoldingRegisters(0, 12);
            sensor.level = val.buffer.readFloatBE(0).toFixed(3)
            sensor.rate = val.buffer.readFloatBE(4).toFixed(2)
        }
        if(id == 3) {
            let val = await client.readHoldingRegisters(0, 10);
            let ch1 = val.buffer.readInt16BE(0);
            let ch2 = val.buffer.readInt16BE(2);
            let a1 = (ch1/100 * 1000) * 0.0200
            let a2 = (ch2/100 * 1000) * 0.072
            wind.speed = a1.toFixed(2)
            wind.direction = a2.toFixed(2)
        }

        logger.set(sensor)
        young.set(wind)
        console.log(wind)
        return sensor
        // return the value
    } catch(e){
        // if error return -1
       return -1
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

io.on('connection', (socket) => {
    setInterval(() => {
        socket.emit('logger', sensor)
    }, 1000)
})

// start get value
getMetersValue(metersIdList);

setInterval(() => {
    const date = new Date()
    const timestamp = Math.round(date.getTime() / 1000)
    const modbus = {
        ph: sensor.ph,
        temp: sensor.temp,
        cod: sensor.cod,
        tss: sensor.tss,
        nh3n: sensor.nh3n,
        timestamp: timestamp
    }
    axios.post('https://apidemo.dwitamaelektrindo.com/api/modbus', modbus, {
        headers: {
            Authorization: 'Bearer 111|hVio5sSvO2ETxgZKgH5bTdAzJAKy77AWVvp4EoxU'
        }
    })
    .then(() => {
        console.log('data')
    })
    .catch(err => {
        console.log(err)
    })
}, 120000)


const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log(`server is runing on port ${PORT}`));

