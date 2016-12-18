// paymentNotificationServer.js ~ Copyright 2016 Mancehster Makerspace ~ MIT License
var slack = require('./our_modules/slack_intergration.js');// import our slack module
var crypto = require('./our_modules/crypto.js');           // abstracted message scrambling

var sockets = {                                            // instantiate socket server
    server: require('socket.io'),                          // grab socket.io library
    doorbotoID: null,
    listen: function(server){                              // create server and setup on connection event
        sockets.server = sockets.server(server);           // pass in http server to connect to
        sockets.server.on('connection', function(socket){  // when a client connects
            socket.on('authenticate', socket.authenticate(socket));// make sure who is trying to connect with us knows our secret
        });
    },
    authenticate: function(socket){ // not that it matters to much if you send it in plain text over the wire
        return function(token){
            if(token === process.env.DOORBOTO_TOKEN){ // make sure we are connected with one doorboto
                if(sockets.doorboto){                 // dafaq? will the real doorboto please stand up
                    console.log('someone else wants to be doorboto?');
                } else {                              // given this is one doorboto
                    sockets.doorbotoID = socket.id;
                    // socket.on('newMember', member.register);       // in event of new registration
                    // socket.on('doorEvent', member.entry);
                    socket.on('disconnect', sockets.doorbotoDisconnect);
                }
            } else {
                console.log('Rando socket connected: ' + socket.id);
                socket.on('disconnect', function(){console.log('Rando socket disconnected: ' + socket.id);});
            }
        };
    },
    disconnect: function(){
        sockets.doorbotoID = null; // takes doorbotos old socket.id out of memory to allow him to reconnect
        // make want to tell slack channel that doorboto just got disconnected
    }
};

var paypal = {
    request: require('request'),
    querystring: require('querystring'),
    options: function (postreq, responseURI){
        return {
            uri: responseURI, method: 'POST', headers:{'Connection': 'close'},
            body: postreq, strictSSL: true, rejectUnauhtorized: false,
            requestCert: true, agent: false
        };
    },
    listenEvent: function(responseURI){                                    // create route handler for test or prod
        return function(req, res){                                         // route handler
            if(req.body){                                                  // verify payment is comming from a payment to our email
                res.status(200).send('OK');                                // ACK notification
                res.end();                                                 // end response
                console.log('original request body:'+ JSON.stringify(req.body));
                if(req.body.reciever_email === process.env.PAYPAL_EMAIL){  // make sure we are meant to recieve this payment
                    var postreq = 'cmd=_notify-validate';    // read ipn message and prepend with _notify-validate and post back to paypal
                    for(var key in req.body){                // not quite sure that this is right its from an example
                        if(req.body.hasOwnProperty(key)){    // for all keys
                            postreq = postreq + '&' + key + '=' + paypal.querystring.escape(req.body[key]); // build new post body
                        }
                    }    // Prove they sent what they think they sent you, post it back to them
                    paypal.request(paypal.options(postreq, responseURI), paypal.requestResponse(req.body));
                } else { // log any funny business
                    console.log('reciever email:' + req.body.receiver_email + ' is not equel to ' + process.env.PAYPAL_EMAIL);
                }
            }
        };
    },
    requestResponse: function(oBody){
        return function(error, response, body){
            console.log('response body:'+ JSON.stringify(body));
            if(error){slack.sendAndLog('IPN response issue:' + error);}
            else if(response.statusCode === 200){
                console.log(JSON.stringify(oBody));       // get an idea of data we are dealing with
                if(body.substring(0, 8) === 'VERIFIED'){
                    // send oBody.txn_id to note transaction number, if number is same as an old one its invalid
                    if(oBody.payment_status === 'Completed'){ // varify that this is a completed payment
                        slack.send('$'+ oBody.mc_gross + ' pament for '+ oBody.itemName+' from '+ oBody.first_name +' '+ oBody.last_name);
                    } // send to renewal channel who just paid!
                } else if (body.substring(0, 7) === 'INVALID') {
                    slack.sendAndLog('Invalid IPN POST'); // IPN invalid, log for manual investigation
                }
            } else {slack.sendAndLog('IPN post, other code: ' + response.statusCode);}
        };
    }
};

var serve = {                                                // depends on cookie, routes, handles express server setup
    express: require('express'),                             // server framework library
    parse: require('body-parser'),                           // middleware to parse JSON bodies
    theSite: function (){                                    // methode call to serve site
        var app = serve.express();                           // create famework object
        var http = require('http').Server(app);              // http server for express frameworkauth)
        app.use(serve.parse.urlencoded({extended: true}));   // support URL-encoded bodies
        app.use(serve.express.static(__dirname + '/views')); // serve page dependancies (sockets, jquery, bootstrap)
        var router = serve.express.Router();                 // create express router object to add routing events to
        router.get('/', function(req, res){res.send('Everything is going to be ok kid, Everythings going to be OKAY');});
        router.post('/ipnlistener', paypal.listenEvent('https://www.paypal.com/cgi-bin/webscr'));   // real listener post route
        router.post('/sand', paypal.listenEvent('https://www.sandbox.paypal.com/cgi-bin/webscr'));  // test with paypal's IPN simulator
        router.post('/test', paypal.listenEvent('http://localhost:8378/test'));                     // test w/ a local IPN simulator
        app.use(router);                                     // get express to user the routes we set
        return http;
    }
};

var http = serve.theSite();                                  // set express middleware and routes up
sockets.listen(http);                                        // listen and handle socket connections
http.listen(process.env.PORT);                               // listen on specified PORT enviornment variable
// intilize slack bot to talk to x channel, with what channel it might use
if(slack.init(process.env.SLACK_WEBHOOK_URL, process.env.BROADCAST_CHANNEL, process.env.SLACK_TOKEN)){
    slack.send('Payment listener woke up');
} else {console.log('failed to connect to slack!');}
