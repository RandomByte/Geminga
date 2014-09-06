var express         = require('express'),
    app             = express(),
    ping            = require("ping"),
    wol             = require('wake_on_lan'),
    net             = require('net'),
    JSONSocket      = require('json-socket'),
    config          = require('./config.json'),
    crypto          = require('crypto'),
    bf              = require('browser_fingerprint'),
    nodemailer      = require('nodemailer'),
    os              = require("os");

if (!config || !config.port || !config.resources ||
        !config.password || !config.cookieSecret || !config.sessionSecret) {
    console.log("There's something missing in your config.json, please refer to config.example.json for an example");
    process.exit(1);
}


app.configure(function(){
    if (config.trustProxy === true) {
        app.enable('trust proxy');
    }
    app.use(express.json());
    app.use(express.cookieParser(config.cookieSecret));
    app.use(express.cookieSession({ secret: config.sessionSecret, key: "geminga.sid",
                cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
            }));
    app.use('/app', express.static(__dirname + '/app'));

    app.use(function(err, req, res, next){
        console.log(err);
        res.status(err.status || 500);
        res.send({ error: err });
    });

    app.use(app.router);
});

app.listen(config.port);
console.log(new Date().getTime() + " Geminga running on port " + config.port);

var aResources = config.resources,
    aSessions = [],
    oSuspects = {},
    oAttackers = {},
    oFingerprintOptions = {
        toSetCookie: false,
        onlyStaticElements: true,
    },
    aPublicResourceData = ["id", "name", "location", "actions"];


app.get('/', function(req, res){
    if (req.session && aSessions.indexOf(req.session) !== -1) {
        res.redirect("/app/index.html");    
    } else {
        res.redirect("/app/login.html");
    }
});

app.post('/api/login', function(req, res) {
    bf.fingerprint(req, oFingerprintOptions, function(fingerprint, elementHash, cookieHash){
        var oSuspect,
            oAttacker,
            oYesterday,
            ipKey = "IP_" + crypto.createHash('sha1').update(req.ips.length > 0 ? req.ips[0] : req.ip).digest('hex'),
            bfKey = "REQUEST_FINGERPRINT_" + fingerprint;
    
        if (oAttackers[ipKey]) {
            oAttacker = oAttackers[ipKey];
        } else if (oAttackers[bfKey]) {
            oAttacker = oAttackers[bfKey];
        }
        if (oAttacker) {
            // Check if last seen less than 24 hours ago
            oYesterday = new Date();
            oYesterday.setHours(oYesterday.getHours() - 24);
            if (oAttacker.lastSeen > oYesterday.getTime()) {
                // last seen less than 24 hours ago -> keep blocking
                console.log(new Date().getTime() + " Blocked potential attack from " + ipKey + " " + bfKey);
                if (config.logAttackIpInCleartext === true) {
                    console.log(new Date().getTime() + " Attacking ip is " + req.ips.length > 0 ? req.ips[0] : req.ip);
                }
                oAttacker.lastSeen = new Date().getTime();
                res.redirect("/app/login.html");
                return;
            } else {
                // last seen more than 24 hours ago -> demote to suspect
                oAttacker.tries = 0;

                oSuspects[ipKey] = oAttacker;
                oSuspects[bfKey] = oAttacker;

                oAttackers[ipKey] = undefined;
                oAttackers[bfKey] = undefined;

                // continuing normal processing
            }
        }

        if (req.session && aSessions.indexOf(req.session) !== -1) {
            res.redirect("/app/index.html");
        } else if (req.body.password === config.password) {
            req.session = generateGuid();
            aSessions.push(req.session);
            res.send(200);
        } else if (req.body.password || req.session) {
            // Password is supplied but didn't match --> suspicious
            
            if (oSuspects[ipKey]) {
                oSuspect = oSuspects[ipKey];
            } else if (oSuspects[bfKey]) {
                oSuspect = oSuspects[bfKey];
            }

            if (oSuspect) {
                oSuspect.tries++;
                oSuspect.lastSeen = new Date().getTime();

                console.log(new Date().getTime() +
                    " Known suspect " + ipKey + " " + bfKey + " tried " + oSuspect.tries + " times");

                if (oSuspect.tries >= 3) {
                    // Promote to attacker
                    console.log(new Date().getTime() + " Promoting " + ipKey + " " + bfKey + " from suspect to attacker");
                    sendMailToAdmin("[WARNING] Potential attack of Geminga on " + os.hostname(), "A potential attack of Geminga running on host " + os.hostname() + " was detected. Further requests will be silently blocked. Please check your server logs.\n\n " + ipKey + "\n" + bfKey);

                    oAttackers[ipKey] = oSuspect;
                    oAttackers[bfKey] = oSuspect;

                    oSuspects[ipKey] = undefined;
                    oSuspects[bfKey] = undefined;
                }
            } else {
                // Add new suspect
                console.log(new Date().getTime() + " New suspect " + ipKey + " " + bfKey);
                oSuspect = {
                    tries: 1,
                    firstSeen: new Date().getTime(),
                    lastSeen: new Date().getTime()
                };
                oSuspects[ipKey] = oSuspect;
                oSuspects[bfKey] = oSuspect;
            }
            res.redirect("/app/login.html");
        } else {
            res.redirect("/app/login.html");
        }
    });
});

app.get('/api/logout', function(req, res) {
    var iIndex;
    if (req.session) {
        iIndex = aSessions.indexOf(req.session);
        if (iIndex > -1) {
            aSessions.slice(iIndex, 1);
            req.session = null;
            res.redirect("/app/login.html");
        } else {
            req.session = null;
            res.redirect("/app/login.html");
        }
    } else {
        res.send(400);
    }
});

// Status
app.get('/api/resources', function(req, res){
    if (!req.session || aSessions.indexOf(req.session) === -1) {
        res.send(401);
    } else {
        var aPublicResources = [];

        for (var i = 0; i < aResources.length; i++) {
            var oInternalResource = aResources[i],
                oPublicResource = {};

            for (var j = 0; j < aPublicResourceData.length; j++) {
                oPublicResource[aPublicResourceData[j]] = oInternalResource[aPublicResourceData[j]];
            };

            aPublicResources.push(oPublicResource);
        };

        res.send(200, aPublicResources);
    }
});

app.get('/api/status/:resource', function(req, res){
    if (!req.session || aSessions.indexOf(req.session) === -1) {
        res.send(401);
    } else {
        for (var i = aResources.length - 1; i >= 0; i--) {
            var oResource = aResources[i],
                oResponse = {};

            if (oResource.id === req.params.resource) {

                if (oResource.token) {
                    sendCommandToResource(oResource, "checkConnectivity",
                        function (oRes) {
                            res.send({ alive: true, remoteConnected: true, states: oRes.states });
                        },
                        function (oError) {
                            ping.sys.probe(oResource.ip || oResource.hostname, function(bAlive) {
                                res.send({ alive: bAlive, remoteConnected: false });
                            }); 
                        });
                } else {
                    ping.sys.probe(oResource.ip || oResource.hostname, function(bAlive) {
                        res.send({ alive: bAlive });
                    });    
                }
                return;
            }
        }
    }
});

// Wake on Lan
app.get('/api/wake/:resource', function(req, res){
    if (!req.session || aSessions.indexOf(req.session) === -1) {
        res.send(401);
    } else {
        for (var i = aResources.length - 1; i >= 0; i--) {
            var oResource = aResources[i];

            if (oResource.id === req.params.resource) {
                if (!oResource.mac) {
                    res.send(500, { error: "No MAC adress specified for " + oResource.name });
                }
                else if (oResource.actions.indexOf("wake") === -1) {
                    res.send(400, { error: "Action not activated for " + oResource.name });
                } else {
                    wol.wake(oResource.mac, function(oError) {
                        if (oError) {
                            res.send(500, { error: oError });
                        } else {
                            res.send(200);
                        }
                    });    
                }
                return;
            }
        }
    }
});

// Shutdown
app.get('/api/shutdown/:resource', function(req, res){
    if (!req.session || aSessions.indexOf(req.session) === -1) {
        res.send(401);
    } else {
        for (var i = aResources.length - 1; i >= 0; i--) {
            var oResource = aResources[i];

            if (oResource.id === req.params.resource) {
                if (oResource.actions.indexOf("shutdown") === -1) {
                    res.send(400, { error: "Action not activated for " + oResource.name });
                } else {
                    sendCommandToResource(oResource, "shutdown",
                        function (oRes) {
                            res.send(200);
                        },
                        function (oError) {
                            res.send(500, { error: oError });
                        });
                }
                return;
            }
        }
    }
});

/*** VPN ***/
app.get('/api/vpn-start/:resource', function(req, res){
    if (!req.session || aSessions.indexOf(req.session) === -1) {
        res.send(401);
    } else {
        for (var i = aResources.length - 1; i >= 0; i--) {
            var oResource = aResources[i];

            if (oResource.id === req.params.resource) {
                if (oResource.actions.indexOf("vpn-start") === -1) {
                    res.send(400, { error: "Action not activated for " + oResource.name });
                } else {
                    sendCommandToResource(oResource, "vpn-start",
                        function (oRes) {
                            res.send(200);
                        },
                        function (oError) {
                            res.send(500, { error: oError });
                        });
                }
                return;
            }
        }
    }
});

app.get('/api/vpn-stop/:resource', function(req, res){
    if (!req.session || aSessions.indexOf(req.session) === -1) {
        res.send(401);
    } else {
        for (var i = aResources.length - 1; i >= 0; i--) {
            var oResource = aResources[i];

            if (oResource.id === req.params.resource) {
                if (oResource.actions.indexOf("vpn-stop") === -1) {
                    res.send(400, { error: "Action not activated for " + oResource.name });
                } else {
                    sendCommandToResource(oResource, "vpn-stop",
                        function (oRes) {
                            res.send(200);
                        },
                        function (oError) {
                            res.send(500, { error: oError });
                        });
                }
                return;
            }
        }
    }
});

function sendCommandToResource (oResource, sCommand, onSuccess, onError) {
    var socket = new JSONSocket(new net.Socket());

    socket.connect(40404, oResource.ip || oResource.hostname);
   
    socket.on('connect', function() { //Don't send until we're connected
        socket.sendMessage({ command: sCommand, token: oResource.token});
    });
    socket.on('message', function(oRes) {
        if (oRes.error) {
            onError(oRes.error);
        } else {
            onSuccess(oRes);   
        }
    });
    socket.on('error', function(oError) {
        onError(oError);
    });
}

var mailTransporter = nodemailer.createTransport();

function sendMailToAdmin (sSubject, sText) {
    if (config.adminAddress) {
        console.log("Sending mail to " + config.adminAddress)
        mailTransporter.sendMail({
            from: 'geminga@' + os.hostname(),
            to: config.adminAddress,
            subject: sSubject,
            text: sText
        });
    }
}


function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1);
};

function generateGuid() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
         s4() + '-' + s4() + s4() + s4();
}