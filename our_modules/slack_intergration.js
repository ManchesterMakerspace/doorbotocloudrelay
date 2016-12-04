// slack.js ~ Copyright 2016 Manchester Makerspace ~ License MIT

var slack = {
    webhook: require('@slack/client').IncomingWebhook, // url to slack intergration called "webhook" can post to any channel as a "bot"
    request: require('request'),                       // needed to make post request to slack api
    init: function(webhookURL, channelToSentTo, token){// runs only once on server start up (may be we should timeout retrys)
        try {                                          // slack is not a dependancy, will fail softly if no internet or slack
            slack.token = token;                       // authentication to post as and invidual (in this case an admin user is needed to inivite new members)
            slack.wh = new slack.webhook(webhookURL, { // instantiate webhook (bot) w/ its url and profile
                username: 'doorboto',                  // Name of bot
                channel: channelToSentTo,              // channel that this intergration spams in particular
                iconEmoji: ':robot_face:',             // icon emoji that bot uses for a profile picture
            });
            return true;                               // note succesful start up
        } catch(error){                                // handle not being connected
            console.log('no connection to slack:' + error);
            return false;                              // note unsuccesfull start up
        }
    },
    send: function(msg){
        try         {slack.wh.send(msg);}                                        // try to send
        catch(error){console.log('slack: No Sendy:'+ msg + ' - Cause:'+ error);} // fail softly if slack or internet is down
    },
    sendAndLog: function(msg){
        slack.send(msg);
        console.log(msg);
    },
    invite: function(channels, email, newMember){
        try {                                               // there are no errors only unexpected results
            channels = '&channels=' + channels;             // prepend channel param w/ param indicator
            var emailReq = '&email=' + email;               // NOTE: has to be a valid email, no + this or that
            var inviteAddress = 'https://slack.com/api/users.admin.invite?token=' + slack.token + emailReq + channels;
            slack.request.post(inviteAddress, function(error, response, body){
                var msg = 'NOT MADE';                       // default to returning a possible error message
                if(error){slack.failedInvite(error);}       // post request error
                else if (response.statusCode == 200){       // give a good status code
                    body = JSON.parse(body);
                    if(body.ok){                            // check if reponse body ok
                        msg = 'invite pending';             // if true, success!
                    } else {                                // otherwise
                        if(body.error){slack.failedInvite('error ' + body.error);} // log body error
                    }
                } else {                                    // maybe expecting possible 404 not found or 504 timeout
                    slack.failedInvite('other status ' + response.statusCode);   // log different status code
                }
                slack.send(newMember + ' just signed up! Slack invite: ' + msg); // regardless post registration event to whosAtTheSpace
            });
        } catch (e){slack.failedInvite(e);}                                      // fail softly in case there is no connection to outside
    },
    failedInvite: function(error){slack.sendAndLog('slack: invite failed:' + error);} // common fail message
};

module.exports = slack;
