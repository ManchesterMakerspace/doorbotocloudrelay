// paymentNotificationServer.js ~ Copyright 2016 Mancehster Makerspace ~ MIT License
var slack = {
    io: require('socket.io-client'),                         // to connect to our slack intergration server
    firstConnect: false,
    connected: false,
    init: function(){
        try {
            slack.io = slack.io(process.env.MASTER_SLACKER); // slack https server
            slack.firstConnect = true;
        } catch (error){
            console.log('could not connect to ' + process.env.MASTER_SLACKER + ' cause:' + error);
            setTimeout(slack.init, 60000); // try again in a minute maybe we are disconnected from the network
        }
        if(slack.firstConnect){
            slack.io.on('connect', function authenticate(){  // connect with masterslacker
                slack.io.emit('authenticate', {
                    token: process.env.CONNECT_TOKEN,
                    slack: {
                        username: 'Payment Listener',
                        channel: 'renewals',
                        iconEmoji: ':moneybag:'
                    }
                }); // its important lisner know that we are for real
                slack.connected = true;
            });
            slack.io.on('disconnect', function disconnected(){slack.connected = false;});
        }
    },
    send: function(msg){
        if(slack.connected){
            slack.io.emit('msg', msg);
        } else {
            console.log('404:'+msg);
        }
    }
};

var mongo = { // depends on: mongoose
    ose: require('mongoose'),
    init: function(db_uri){
        mongo.ose.connect(db_uri);                                            // connect to our database
        var reqMsg = '{PATH} is required';                                    // warning message for required feilds
        var paymentSchema = new mongo.ose.Schema({                            // model of what payment documents will look like
            id: mongo.ose.Schema.ObjectId,                                    // we do this for db's primary index
            product: {type: String, required: reqMsg},                        // item that was paid for
            firstname: {type: String, required: reqMsg},                      // firstname of buyer
            lastname: {type: String, required: reqMsg},                       // lastname of buyer
            amount: {type: Number, required: reqMsg},                         // amount of tender rendered
            currancy: {type: String },                                        // what type of deriro we are talking about
            payment_date: {type: String, required: reqMsg},                   // purchased date, currently not time of membership start
            payer_email: {type: String, required: reqMsg},                    // email of buyer (not nessiarily member)
            address: {type: String},                                          // maybe this is helpfull? its there, we'll take it
            txn_id: {type: String, required: reqMsg},                         // number paypal provides to prevent duplicate transactions
            txn_type: {type: String, required: reqMsg},                       // can indicate failed payments sometimes
            test: {type: Boolean}                                             // was this sent by as simulation or is it real life
        }, {collection: 'general'});                                          // because otherwise mongoose thinks its smart
        mongo.ose.model('general', paymentSchema);
    },
    // basically we have a seperate db for payments that have collections of different types of paypents that are using same model
    saveNewDoc: function(Model, docToSave, errorFunction, successFunction){   // helper method goes through boilerplate save motions
        var docObject = new Model(docToSave);                                 // create a new doc (varifies and adds an object id basically)
        docObject.save(function saveDocResponse(error){                       // attempt to write doc to db
            if(error){if(errorFunction){errorFunction(error);}}               // given an error function handle error case
            else{if(successFunction){successFunction();}}                     // optional success function
        });
    }
};

var payment = {
    eventHandler: function(reciept){                                   // handels all payments sorting them into different types
        var ourRecord = payment.simplify(reciept);
        mongo.saveNewDoc(mongo.general, reciept, function fail(error){
            slack.send('error saving payment ' + error);
        }, function success(){
            slack.send('Payment saved to mLab server');
        });
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
                    slack.send('reciever email:' + req.body.receiver_email + ' is not equel to ' + process.env.PAYPAL_EMAIL);
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
mongo.init(process.env.MONGODB_URI);                         // connect to mLab server
var http = serve.theSite();                                  // set express middleware and routes up
http.listen(process.env.PORT);                               // listen on specified PORT enviornment variable
