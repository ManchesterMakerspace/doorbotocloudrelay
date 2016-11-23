# Payment notification relay

Copyright Mancehster Makerspace 2016 ~ MIT License

Relays payment updates to an access control system

to test locally? put this in an start.sh in this repos directory and chmod +x start.sh

    # This determines whether we are testing w/ sandbox or live deploy ready
    TESTING_STATE=true
    export TESTING_STATE

    # Start on a different port than doorboto. Heroku sets this ENV_VAR to 80
    PORT=3001
    export PORT

    # shared encryption key
    SOCKET_TOKEN="supersecretsecret
    export SOCKET_TOKEN

    # might not need this since paypal is sending info to us we verify if its any good
    PAYPAL_TOKEN="goeshere"
    export PAYPAL_TOKEN

    # Url to webhook that acts as a slack bot
    SLACK_WEBHOOK_URL="goeshere"
    export SLACK_WEBHOOK_URL

    # have a channel to broadcast on
    BROADCAST_CHANNEL="test_channel"
    export BROADCAST_CHANNEL

    # this is needed for the slack invite feature
    SLACK_TOKEN="goeshere"
    export SLACK_TOKEN

    # auto restart on changes w/ nodemon
    nodemon paymentNotificationServer.js
    # or
    # node paymentNotificationServer.js
    # to run once with node.js


High overview notes

* The master branch of this repo is meant to be able to automatically sync to a heroku instance when updated.
* So fork or branch and make a pull request to master, do not directly push to master unless you want to live deploy your changes.
* Keep auto deploy in mind when adding configuration vars.
* Pay attention to how TESTING_STATE environment variable is set, it determines whether it expect post from the paypal dev sandbox or paypal.
