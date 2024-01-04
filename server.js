"use strict";

function inspector() {
    require("inspector").open(2881, "0.0.0.0", false);
}
if (process.env.USER == "runner" || process.cwd == "/app") {
    console.log("In Runner Env Disable Inspector")
} else {
    inspector();
}
function GetUTC() {
    return (new Date()).toUTCString();
}
const UPTIME = GetUTC();
const UPTS = Date.now();
const REPL_ID = process.env.REPL_ID;
const dns = require('dns');
const net = require("net");
// const fs = require("fs");
// const path = require("path");
const url = require("url");
const http = require("http");
const WebSocket = require("ws");
const WebSocketServer = WebSocket.Server;
// const util = require("util");
const doh = require("./doh");
// const memdelay = 5000;

// const logdir = "./Logs/";
// mkdir(logdir);
// const logcfg = {
    // encoding: "utf8",
    // flags: "a"
// };
//const Console = require("console").Console;
//const log    = new Console(fs.createWriteStream(logdir +  "SER_Log.txt")).log;
//const warn   = new Console(fs.createWriteStream(logdir + "SER_Warn.txt")).log;
//const memlog = new Console(fs.createWriteStream(logdir +  "SER_Mem.txt", logcfg)).log;
const log = console.log;
const warn = console.warn;

const {
    Encryptor
} = require("./encrypt");

function inetNtoa(buf) {
    return buf[0] + "." + buf[1] + "." + buf[2] + "." + buf[3];
}

const config = {
    timeout: 600,
    local_address: "0.0.0.0",
    remote_port: 1081,
    password: "X-fromenv",
    method: "AES-256-CFB"
};

if (process.env.PORT) {
    config["remote_port"] = +process.env.PORT;
}
if (process.env.KEY) {
    config["password"] = process.env.KEY;
}
if (process.env.METHOD) {
    config["method"] = process.env.METHOD;
}

const timeout = Math.floor(config.timeout * 1000);
const LOCAL_ADDRESS = config.local_address;
const PORT = config.remote_port;
const KEY = config.password;
let METHOD = config.method;

if (["", "null", "table"].includes(METHOD.toLowerCase())) {
    METHOD = null;
}

var DnsCache = {}
function ReplaceAddr(remoteAddr) {
    if (DnsCache[remoteAddr] != undefined) {
        let RA = DnsCache[remoteAddr];
        if (RA.Status == 0) {
            remoteAddr = RA.Address[RA.index];
            RA.index++;
            if (RA.index + 1 >= RA.Address.length) {
                RA.index = 0;
            }
        }
    }
    return remoteAddr;
}
function CacheAddr(remoteAddr, Addr) {
    DnsCache[remoteAddr] = {
        Status: 0,
        index: 0,
        Address: Addr
    }
}
function ResDns(remoteAddr) {
    if (DnsCache[remoteAddr] != undefined) {
        if (DnsCache[remoteAddr].Status == 1) {
            return;
        }
    }
    DnsCache[remoteAddr] = {
        Status: 1
    };
    doh(remoteAddr, function (addr, err) {
        if (err.err) {
            log(addr, err)
            DnsCache[remoteAddr] = undefined;
            return;
        }
        log(remoteAddr, addr)
        CacheAddr(remoteAddr, addr)
    })

}
function mylookup(hostname, options, callback) {
    console.log("lookup", hostname)
    dns.lookup(hostname, options, callback)
}
const server = http.createServer(servOnRequest);
function KMG(num) {
    let suf = ["B", "KB", "MB", "GB", "PB", "ZB"]
    let rnum = num + " B";
    for (let i in suf) {
        if (num <= 1024) {
            rnum = num + " " + suf[i];
            break;
        }
        num /= 1024;
    }
    return rnum;
}
function MsHMS(num) {
    let Sm = 1000;
    let Mm = Sm * 60;
    let Hm = Mm * 60;
    let Dm = Hm * 24;

    let day = Math.floor(num / Dm);
    let tn = num % Dm;
    let hour = Math.floor(tn / Hm);
    tn = tn % Hm;
    let min = Math.floor(tn / Mm);
    tn = tn % Mm;
    let sec = Math.floor(tn / Sm);
    let ms = tn % Sm;
    return `${day} day ${hour} hour ${min} min ${sec} sec ${ms} ms`
}

function mem() {
    let u = process.memoryUsage();
    return {
        "VER": process.version,
        "PLATFORM": process.platform,
        "ARCH": process.arch,
        "UPTIME": UPTIME,
        "UTTIME": GetUTC(),
        "RT": MsHMS(Date.now() - UPTS),
        "rss": KMG(u.rss),
        "heapTotal": KMG(u.heapTotal),
        "heapUsed": KMG(u.heapUsed),
        "external": KMG(u.external),
        "UUID": REPL_ID
    }
}
// function printmem() {
    // memlog((new Date()).toISOString(), JSON.stringify(mem()))
    // setTimeout(printmem, memdelay);
// }
//setTimeout(printmem, memdelay);

function servOnRequest(request, response) {
    log((new Date()).toISOString(), request.method, decodeURIComponent(request.url))
    var parsed = url.parse(request.url, true);

    switch (parsed.pathname) {
    case "/kill":
        NC(response);
        response.writeHead(204);
        response.end();
        process.exit(1)
        break;

    case "/global-gc":
        NC(response);
        response.setHeader("Content-Type", "application/json");

        if (typeof global.gc == "function") {
            response.writeHead(200);
            response.write(JSON.stringify(mem(), null, 2) + "\n");
            global.gc();
            response.write(JSON.stringify(mem(), null, 2) + "\n");
            response.end()
        } else {
            response.writeHead(500);
            response.write("global.gc is not a function , run node with --expose-gc");
            response.end()
        }
        break;

    case "/dnc":
        NC(response);
        response.writeHead(200, {
            "Content-Type": "application/json"
        });
        response.end(JSON.stringify(DnsCache, null, 2));
        break;

    case "/lookup":
        NC(response);
        if (parsed.query.name == undefined || parsed.query.name == "") {
            response.writeHead(400);
            response.end(JSON.stringify({
                    "code": 400,
                    "msg": "reqired request param undefined"
                }));
            return;
        }

        doh(parsed.query.name, function (addr, err) {
            response.writeHead(200, {
                "Content-Type": "application/json"
            });
            if (err.err) {
                response.end(JSON.stringify({
                        "code": err.err,
                        "msg": err.error
                    }, null, 2));
                return;
            }

            response.end(JSON.stringify({
                    "code": err.err,
                    "msg": "",
                    "data": addr
                }, null, 2));
        })

        break;

    default:
        response.writeHead(200, {
            "Content-Type": "application/json"
        });

        //response.write(util.inspect(process.versions) + "\n")
        //response.write(util.inspect(process.release) + "\n")
        response.write(JSON.stringify(mem(), null, 2) + "\n");
        // response.write(util.inspect(process.config) + "\n")
        return response.end("");
    }
}
function NC(response) {
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Expires", "Thu, 12 Jan 1980 00:00:00 GMT");
}

const wss = new WebSocketServer({
    server
});

wss.on("connection", function (ws) {
    log("server connected");
    // log("concurrent connections:", wss.clients.size);
    let encryptor = new Encryptor(KEY, METHOD);
    let stage = 0;
    let headerLength = 0;
    let remote = null;
    let cachedPieces = [];
    let addrLen = 0;
    let remoteAddr = null;
    let rawAddr = null;
    let remotePort = null;
    ws.on("message", function (data) {
        data = encryptor.decrypt(data);
        if (stage === 5) {
            remote.write(data);
        }
        if (stage === 0) {
            try {
                let addrtype = data[0];
                if (addrtype === 3) {
                    addrLen = data[1];
                } else if (addrtype !== 1) {
                    warn(`unsupported addrtype: ${addrtype}`);
                    ws.close();
                    return;
                }
                // read address and port
                if (addrtype === 1) {
                    remoteAddr = inetNtoa(data.slice(1, 5));
                    remotePort = data.readUInt16BE(5);
                    headerLength = 7;
                } else {
                    remoteAddr = data.slice(2, 2 + addrLen).toString("binary");
                    remotePort = data.readUInt16BE(2 + addrLen);
                    headerLength = 2 + addrLen + 2;
                }
                rawAddr = remoteAddr;
                remoteAddr = ReplaceAddr(remoteAddr);

                log("connecting", rawAddr, remoteAddr, remotePort);
                // connect remote server
                remote = net.connect({
                    port: remotePort,
                    host: remoteAddr,
                    lookup: mylookup
                }, function () {
                    let i = 0;
                    while (i < cachedPieces.length) {
                        remote.write(cachedPieces[i]);
                        cachedPieces[i] = null;
                        i++;
                    }
                    cachedPieces = null; // save memory
                    stage = 5;
                });
                remote.on("data", function (rdata) {
                    rdata = encryptor.encrypt(rdata);
                    remote.pause();
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(rdata, {
                            binary: true
                        },
                            function () {
                            remote.resume();
                        });
                    }
                });

                remote.on("end", function () {
                    ws.close();
                    log("remote disconnected");
                });

                remote.on("error", function (e) {
                    ws.terminate();
                    log("remote:", remoteAddr, remotePort, e);
                    ResDns(remoteAddr);
                });

                remote.setTimeout(timeout, function () {
                    log("remote timeout");
                    remote.destroy();
                    ws.close();
                });

                if (data.length > headerLength) {
                    // make sure no data is lost
                    let buf = new Buffer(data.length - headerLength);
                    data.copy(buf, 0, headerLength);
                    cachedPieces.push(buf);
                    // buf = null;
                }
                stage = 4;
            } catch (error) {
                // may encouter index out of range
                const e = error;
                warn(e);
                if (remote) {
                    remote.destroy();
                }
                ws.close();
            }
        } else if (stage === 4) {
            // remote server not connected
            // cache received buffers
            // make sure no data is lost
            cachedPieces.push(data);
        }
    });

    ws.on("ping", () => ws.pong("", null, () => {}));

    ws.on("close", function () {
        log("server disconnected");
        log("concurrent connections:", wss.clients.size);
        cachedPieces = null;
        if (remote) {
            remote.destroy();
        }
    });

    ws.on("error", function (e) {
        warn(`server: ${e}`);
        log("concurrent connections:", wss.clients.size);
        cachedPieces = null;
        if (remote) {
            remote.destroy();
        }
    });
});

server.listen(PORT, LOCAL_ADDRESS, function () {
    const address = server.address();
    console.log("server listening at", address);
});

server.on("error", function (e) {
    if (e.code === "EADDRINUSE") {
        console.log("address in use, aborting");
    }
    process.exit(1);
});
// function mkdir(mpath) {
//     mpath = path.resolve(mpath);
//     if (fs.existsSync(mpath)) {
//         if (!fs.statSync(mpath).isDirectory()) {
//             return 1;
//         } else {
//             return 0;
//         }
//     } else {
//         var tmp_mpath = path.resolve(mpath + "/../");
//         if (fs.existsSync(tmp_mpath)) {
//             fs.mkdirSync(mpath);
//         } else {
//             mkdir(tmp_mpath);
//             fs.mkdirSync(mpath);
//         }
//     }
// }
// 