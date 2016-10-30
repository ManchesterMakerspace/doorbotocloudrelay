#Payment notification relay

Relays payment updates to an access control system

to test locally? put this in an start.sh and chmod +x start.sh

    TESTING_STATE=true
    export TESTING_STATE

    PORT=3000
    export PORT

    SOCKET_TOKEN="supersecretsecret"
    export SOCKET_TOKEN

    PAYPAL_TOKEN="goeshere"
    export PAYPAL_TOKEN

    SLACK_WEBHOOK_URL="goeshere"
    export SLACK_WEBHOOK_URL

    SLACK_TOKEN="goeshere"
    export SLACK_TOKEN

    nodemon paymentNotificationServer.js
