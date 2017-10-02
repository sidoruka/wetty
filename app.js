var express = require('express');
var http = require('http');
var path = require('path');
var server = require('socket.io');
var pty = require('pty.js');

var opts = require('optimist')
    .options({
        sshport: {
            demand: false,
            description: 'ssh server port'
        },
        sshuser: {
            demand: false,
            description: 'ssh user'
        },
	    sshpass: {
            demand: false,
            description: 'ssh pass'
        },
        port: {
            demand: true,
            alias: 'p',
            description: 'wetty listen port'
        },
    }).boolean('allow_discovery').argv;

var sshport = 22;
var sshuser = 'root';
var sshpass = null;

if (opts.sshport) {
    sshport = opts.sshport;
}

if (opts.sshuser) {
    sshuser = opts.sshuser;
}
if (opts.sshpass) {
    sshpass = opts.sshpass;
}

process.on('uncaughtException', function(e) {
    console.error('Error: ' + e);
});

var httpserv;

var app = express();
app.get('/ssh/remote/:server', function(req, res) {
    res.sendfile(__dirname + '/public/ssh/index.html');
});
app.use('/', express.static(path.join(__dirname, 'public')));


httpserv = http.createServer(app).listen(opts.port, function() {
    console.log('http on port ' + opts.port);
});

var io = server(httpserv,{path: '/ssh/socket.io'});
io.on('connection', function(socket){
    var sshhost = 'localhost';
    var request = socket.request;
    console.log((new Date()) + ' Connection accepted.');
    if (match = request.headers.referer.match('/ssh/remote/.+$')) {
        sshhost = match[0].replace('/ssh/remote/', '');
    }  
    var term;
    if(sshpass) {
        term = pty.spawn('sshpass', ['-p', sshpass, 'ssh', sshuser + '@' + sshhost, '-p', sshport], {
            name: 'xterm-256color',
            cols: 80,
            rows: 30
        });
    }
    else {
        term = pty.spawn('ssh', [sshuser + '@' + sshhost, '-p', sshport], {
            name: 'xterm-256color',
            cols: 80,
            rows: 30
        });
    }
    console.log((new Date()) + " PID=" + term.pid + " STARTED on behalf of user=" + sshuser)
    term.on('data', function(data) {
        socket.emit('output', data);
    });
    term.on('exit', function(code) {
        console.log((new Date()) + " PID=" + term.pid + " ENDED")
    });
    socket.on('resize', function(data) {
        term.resize(data.col, data.row);
    });
    socket.on('input', function(data) {
        term.write(data);
    });
    socket.on('disconnect', function() {
        term.end();
    });
})
