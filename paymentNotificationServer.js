//paymentNotificationServer.js
// var slack = require('./slack_intergration.js'); // not sure if it really works this way?

var sockets = {                                             // instantiate socket server
    server: require('socket.io'),                            // grab socket.io library
    listen: function(server){                              // create server and setup on connection event
        sockets.server = sockets.server(server);           // pass in http server to connect to
        sockets.server.on('connection', function(socket){  // when a client connects
            socket.on('authenticate', socket.authenticate);// make sure who is trying to connect with us knows our secret
        });
    },
    authenticate: function(secret){ // not that it matters to much if you send it in plain text over the wire
        if(secret === process.env.SOCKET_TOKEN){ // only make responses to those that know our secret
            // socket.on('newMember', member.register);       // in event of new registration
            // socket.on('doorEvent', member.entry);
        }
    }
};

var paypal = {
    request: require('request'),
    querystring: require('querystring'),
    options: function (postreq, isSandbox){
        return {
            uri: isSandbox ? 'https://www.sandbox.paypal.com/cgi-bin/webscr' : 'https://www.paypal.com/cgi-bin/webscr',
            method: 'POST',
            headers:{'Connection': 'close'},
            body: postreq,
            strictSSL: true,
            rejectUnauhtorized: false,
            requestCert: true,
            agent: false
        };
    },
    listenEvent: function(req, res){
        if(req.body){                             // given we have some body
            res.status(200).send('OK');           // Step 1 ACK notification
            res.end();                            // end response
            var postreq = 'cmd=_notify-validate'; // step 2 read ipn message and prepend with _notify-validate and post back to paypal
            for(var key in req.body){
                if(req.body.hasOwnProperty(key)){ // for all keys
                    postreq = postreq + '&' + key + '=' + paypal.querystring.escape(req.body[key]); // build new post body
                }
            } // Prove they sent what they think they sent you, post it back to them
            paypal.request(paypal.options(postreq, process.env.TESTING_STATE), paypal.requestResponse(req.body));
        }
    },
    requestResponse: function(originalBody){
        return function(error, response, body){
            if(error){
                console.log('response error:' + error);
            } else if(response.stautsCode === 200){
                if(body.substring(0, 8) === 'VERIFIED'){
                    console.log(JSON.stringify(originalBody));
                } else if (body.substring(0, 7) === 'INVALID') {
                    console.log('Invalid IPN!'.error); // IPN invalid, log for manual investigation
                }
            }
        };
    }
};

/*var paypal = {                             // Must respond to PayPal IPN request with an empty 200 first
    ipn: require('paypal-ipn'),            // library for IPN verification
    listenEvent: function(res, req){
        res.status(200).send('OK'); // ??
        // res.status(200, 'OK'); // when does this really need to be done?
        paypal.ipn.verify(req.body, {'allow_sandbox': true}, paypal.IPNvarified);
    },
    IPNvarified: function(error, msg){
        if(error){
            console.log(error);
        } else {
            // do the things
            if(params.payment_status === 'Completed'){
                console.log('someone just made a payment:'+ msg);
                // Completed payment
            }
        }
    }
};*/

var serve = {                                                // depends on cookie, routes, handles express server setup
    express: require('express'),                             // server framework library
    parse: require('body-parser'),                           // middleware to parse JSON bodies
    theSite: function (){                                    // methode call to serve site
        var app = serve.express();                           // create famework object
        var http = require('http').Server(app);              // http server for express frameworkauth)
        // app.use(serve.parse.json());                         // support JSON-encoded bodies
        app.use(serve.parse.urlencoded({extended: true}));   // support URL-encoded bodies
        app.use(serve.express.static(__dirname + '/views')); // serve page dependancies (sockets, jquery, bootstrap)
        var router = serve.express.Router();                 // create express router object to add routing events to
        router.get('/', function(req, res){res.send('Everything is going to be ok kid, Everythings going to be OKAY');});
        router.post('/ipnlistener', paypal.listenEvent);     // request registration page
        app.use(router);                                     // get express to user the routes we set
        return http;
    }
};

var http = serve.theSite();     // set express middleware and routes up
// sockets.listen(http);            // listen and handle socket connections
http.listen(process.env.PORT);  // listen on specified PORT enviornment variable
// slack.init();
