# Payment notification relay

Copyright Mancehster Makerspace 2016 ~ MIT License

Relays payment updates to an access control system

to test locally? put this in an start.sh in this repos directory and chmod +x start.sh

    # This determines whether we are testing w/ sandbox or live deploy ready
    TESTING_STATE=true
    export TESTING_STATE

    # Start on a different port than doorboto. Heroku sets this ENV_VAR to 80
    export PORT=3000
    # token for folks to connect to us
    export AUTH_TOKEN="supersecretsecret"
    export SOCKET_TOKEN

    # master slacker https address
    export MASTER_SLACKER="https://wateveryouslacerisnamed.herokuapp.com"
    # token to connect to masterslacker
    export CONNECT_TOKEN="yourtokentoconnenttothemasterslacker"

    # auto restart on changes w/ nodemon
    nodemon paymentNotificationServer.js
    # or
    # node paymentNotificationServer.js
    # to run once with node.js


High overview notes

* The production branch of this repo is meant to be able to automatically sync to a heroku instance when updated.
* So fork or branch and make a pull request to production to deploy changes
* Keep auto deploy in mind when adding configuration vars.
* Pay attention to how TESTING_STATE environment variable is set, it determines whether it expect post from the paypal dev sandbox or paypal.
