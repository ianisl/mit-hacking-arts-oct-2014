// MIT Hacking Arts project, October 3-5, 2014

var osc = require("node-osc"),
    firmata = require("firmata"),
    keypress = require('keypress'),
    stdin = process.stdin,
    argv = require('optimist').argv;

// Parameters
var oscPort = 8000;
var servoPin = 9;
var speedScaling = 100
var speedAverageSamplingSize = 5;
var maxSpeed = 1;
var motorUpdateInterval = 20; // in ms
var speedDecayInterval = 100; // in ms
var speedDecayAmount = 0.2; // in %

if (isInt(argv.oscport)) {
    oscPort = argv.oscport;
}

var board = new firmata.Board('/dev/tty.usbmodem1421', function(err) {
    // Arduino
    if (err) {
        console.log(err);
        return;
    }
    console.log('Board connected');
    board.pinMode(servoPin, board.MODES.SERVO);
    // Osc and motor
    var speed = 0;
    var timeInterval, travel, previousTime, previousPosition;
    var speedSamples = [];
    var max = -1
    var min = 99999;
    var averageSpeed = 0;
    var oscServer = new osc.Server(8000, '0.0.0.0');
    oscServer.on("message", function(msg, rinfo) {
        if (msg[0] === "/1/xy1") {
            currentTime = new Date().getTime();
            if (previousTime > 0) {
                timeInterval = currentTime - previousTime;
                travel = msg[1] - previousPosition;
                var speed = travel / timeInterval * speedScaling;
                previousTime = currentTime;
                previousPosition = msg[1];
                if (isFinite(speed)) {
                    speedSamples.push(speed);
                    var samplesInExcess = speedSamples.length - speedAverageSamplingSize;
                    if (samplesInExcess > 0) {
                        speedSamples.splice(0, samplesInExcess);
                    }
                }
                averageSpeed = clamp(getAverage(speedSamples));
                // if (average > max) {
                //     max = average;
                // }
                // if (average < min) {
                //     min = average;
                // }
                // console.log("min: " + min + " max: " + max);
            } else {
                previousTime = currentTime;
                previousPosition = msg[1];
            }
        }
    });
    // Motor update
    setInterval(function() {
        board.servoWrite(servoPin, 90 * (1 + averageSpeed));        
    }, motorUpdateInterval);
    // Speed decay
    setInterval(function() {
        averageSpeed = averageSpeed * (1 - speedDecayAmount);
    }, speedDecayInterval);
    // Keypress
    keypress(process.stdin);
    process.stdin.on('keypress', function (ch, key) {
        if (key && key.name == 'q') {
            process.exit();
        }
    });
    process.stdin.setRawMode(true);
    process.stdin.resume();
});

function isInt(n) {
    return typeof n === 'number' && n % 1 == 0;
}

process.on('uncaughtException', function(e) {
    console.log(e);
});

function getAverage(a) {
    var sum = 0;
    a.forEach(function(e) {
        sum += e;
    });
    return sum/a.length;
}

function clamp(s) {
    if (s > maxSpeed || s < - maxSpeed) {
        s = s/s * maxSpeed;
    }
    return s;
}