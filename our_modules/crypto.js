// Nodejs encryption with CTR
var crypto = {
    library: require('crypto'),
    algorithm: process.env.ENCRYPT_ALGORITHM,
    password: process.env.SHARED_KEY,
    encrypt: function(text){
        var cipher = crypto.library.createCipher(crypto.algorithm, crypto.password);
        var crypted = cipher.update(text,'utf8','hex');
        crypted += cipher.final('hex');
        return crypted;
    },
    decrypt: function(text){
        var decipher = crypto.library.createDecipher(crypto.algorithm, crypto.password);
        var dec = decipher.update(text,'hex','utf8');
        dec += decipher.final('utf8');
        return dec;
    },
    encryptJSON: function(json){
        var jsonString = JSON.stringify(json);
        return crypto.encrypt(jsonString);
    },
    decryptJSON: function(blob){ // this doesnt work
        var decrypted = crypto.decrypt(blob);
        return JSON.parse(decrypted);
    }
};

module.exports = crypto;
