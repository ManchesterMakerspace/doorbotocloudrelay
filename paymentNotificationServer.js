// paymentNotificationServer.js ~ Copyright 2016 Mancehster Makerspace ~ MIT License
// var slack = require('./our_modules/slack_intergration.js');// import our slack module
var slack = {
    io: require('socket.io-client'),
    init: function(){
        slack.io = slack.io(process.env.MASTER_SLACKER); // slack https server
        socket.io.on('connect', function authenticate(){       // once we have connected to IPN lisner
            socket.io.emit('authenticate', {
                token: process.env.CONNECT_TOKEN,
                slack: {
                    username: 'Payment Listener',
                    channel: 'renewals',
                    iconEmoji: ':moneybag:'
                }
            }); // its important lisner know that we are for real
        });
    },
    send: function(msg){
        slack.io.emit('msg', msg);
    }
};

var socket = {                                                         // socket.io singleton: handles socket server logic
    services: [],                                                      // array of verified connected services / "emit to" whitelist
    io: require('socket.io'),                                          // grab socket.io library
    listen: function(httpServer, authToken){                           // create server and setup on connection events
        socket.io = socket.io(httpServer);                             // specify http server to make connections w/ to get socket.io object
        socket.io.on('connection', function(client){                   // client holds socket vars and methods for each connection event
            console.log('client connected:'+ client.id);               // notify when clients get connected to be assured good connections
            client.on('authenticate', socket.auth(client, authToken)); // initially clients can only ask to authenticate
        }); // basically we want to authorize our users before setting up event handlers for them or adding them to emit whitelist
    },
    auth: function(client, authToken){                                 // hold socketObj/key in closure, return callback to authorize user
        return function(authPacket){                                   // data passed from service {token:"valid token", name:"of service"}
            if(authPacket.token === authToken && authPacket.name){     // make sure we are connected w/ a trusted source with a name
                var service = {id:client.id, name: authPacket.name};   // form a service object to hold on to
                socket.services.push(service);                         // add service to array of currently connected services
                console.log(socket.listservices());                    // list services that are now currently connected to slack and log
                client.on('slackMsg', function(msg){slack.send(msg);});// we trust these services, just relay messages to our slack channel
                client.on('disconnect', socket.disconnect(service));   // remove service from service array on disconnect
            } else {                                                   // in case token was wrong or name not provided
                slack.send('Rejected socket connection: ' + client.id);
                client.on('disconnect', function(){
                    slack.send('Rejected socket disconnected: ' + client.id);
                });
            }
        };
    },
    disconnect: function(service){                                     // hold service information in closure
        return function(){                                             // return a callback to be executed on disconnection
            var index = socket.services.map(socket.returnID).indexOf(service.id); // figure index of service in service array
            var UTCString = new Date().toUTCString();                  // get a string of current time in est
            if(index > -1){
                socket.services.splice(index, 1);                      // given its there remove service from service array
                slack.send(service.name + ' was disconnected at ' + UTCString);   // give a warning when a service is disconnected
            } else {
                console.log('disconnect error for:' + service.name);  // service is not there? Should never happen but w.e.
            }
        };
    },
    returnID: function(each){return each.id;},                         // helper function for maping out ids from object arrays
    listservices: function(){
        var slackMsg = 'services connected, ';                         // message to build on
        for(var i = 0; i < socket.services.length; i++){               // iterate through connected services
            slackMsg += socket.services[i].name;                       // add services name
            if(i === (socket.services.length - 1)){slackMsg+='.';}     // given last in array concat .
            else                                 {slackMsg+=' and ';}  // given not last in array concat and
        }
        return slackMsg;                                               // send message so that we know whos connected
    },
    authEmit: function(evnt, data){                                    // we only want to emit to services authorized to recieve data
        for(var i = 0; i < socket.services.length; i++){               // for all connected services
            socket.io.to(socket.services[i].id).emit(evnt, data);      // emit data for x event to indivdual socket in our array of services
        }
    }
};

var payment = {
    eventHandler: function(reciept){                                   // handels all payments sorting them into different types
        var ourRecord = payment.simplify(reciept);
        socket.authEmit('payment', ourRecord);
        slack.send( '$'+ reciept.mc_gross + ' pament for '+ reciept.item_name +
                    ' from '+ reciept.first_name +' '+ reciept.last_name +
                    ' ~ email:' + reciept.payer_email + ' <-contact them for card access if they are new'
        );
    },
    simplify: function(reciept){
        var ourRecord = {  // standard information and default settings
            product: reciept.item_name + ' ' + reciept.item_number,
            firstname: reciept.first_name,
            lastname: reciept.last_name,
            amount: reciept.mc_gross,
            currancy: reciept.mc_currency,
            payment_date: reciept.payment_date,
            payer_email: reciept.payer_email,
            address: 'Not Provided',
            txn_id: reciept.txn_id,            // use for varify against double paying
            txn_type: reciept.txn_type,        // will show
            test: false
        };
        // varify inconsistent information below
        if(reciept.address_city && reciept.address_street){ // given there is at least a city and street address
            ourRecord.address = reciept.address_fullname + ' ' + reciept.address_city + ' ' + reciept.address_city + ' ' +
            reciept.address_state + ' ' + reciept.address_zip + ' ' + reciept.address_country_code;
        }
        if(!reciept.item_name){ourRecord.product = reciept.item_name1 + ' ' + reciept.item_number;}
        if(reciept.test_ipn === 1){ourRecord.test = true;}
        if(!reciept.payment_date){ourRecord.payment_date = new Date().toUTCString();} // We should always have a payment time
        return ourRecord; // return simplified payment object that will be stored in our database
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
                if(req.body.receiver_email === process.env.PAYPAL_EMAIL){  // make sure we are meant to recieve this payment
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
            console.log('original request body:'+ JSON.stringify(oBody));
            if(error){slack.send('IPN response issue:' + error);}
            else if(response.statusCode === 200){
                if(body.substring(0, 8) === 'VERIFIED'){
                    // send oBody.txn_id to note transaction number, if number is same as an old one its invalid
                    if(oBody.payment_status === 'Completed'){ // varify that this is a completed payment
                        payment.eventHandler(oBody);          // pass original body to payment handler when we have verified a valid payment
                    }                                         // send to renewal channel who just paid!
                } else if (body.substring(0, 7) === 'INVALID') {
                    slack.send('Invalid IPN POST');     // IPN invalid, log for manual investigation
                }
            } else {slack.send('IPN post, other code: ' + response.statusCode);}
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
        app.use(serve.express.static(__dirname + '/views')); // serve page dependancies (socket, jquery, bootstrap)
        var router = serve.express.Router();                 // create express router object to add routing events to
        router.get('/', function(req, res){res.send('Everything is going to be ok kid, Everythings going to be OKAY');});
        router.post('/ipnlistener', paypal.listenEvent('https://www.paypal.com/cgi-bin/webscr'));   // real listener post route
        router.post('/sand', paypal.listenEvent('https://www.sandbox.paypal.com/cgi-bin/webscr'));  // test with paypal's IPN simulator
        router.post('/test', paypal.listenEvent('http://localhost:8378/test'));                     // test w/ a local IPN simulator
        app.use(router);                                     // get express to user the routes we set
        return http;
    }
};


slack.init();                                                // intilize slack bot to talk to x channel, with what channel it might use
var http = serve.theSite();                                  // set express middleware and routes up
socket.listen(http, process.env.AUTH_TOKEN);                 // listen and handle socket connections
http.listen(process.env.PORT);                               // listen on specified PORT enviornment variable
