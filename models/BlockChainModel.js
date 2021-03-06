'use strict';

var request = require("request");
var rpg = require("rpg");
var upload_qr = require("../upload_qr");
var accountModel = require('./AccountModel.js');

// TODO: Move out of code and into env variable.
var API_CODE = "8a1efaba-63bf-43f6-bd3e-e8ce934c6ef6";

// export functions

/**
 * Query the database for the account with phone number
 * and give back the account object by invoking the callback
 *
 * @param phone {string} the phone number
 * @param callback {function} a callback function with 1 parameter
 */
var getAccount = function (phone, callback) {
  accountModel.findOne({phone: phone}, function (err, account) {
    if (err) {
      console.error(err);
    } else {
      if (callback) {
        if (account) {
          callback(account);
        } else {
          callback(null, "Error: Account does not exist");
        }
      }
    }
  });
};

/**
 * Send a request to the BlockChain server to create a Wallet and
 * save the account information of the Wallet in the database
 *
 * @param phone {string} the phone number
 * @param callback {function} a callback function
 */
var createWallet = function (phone, callback) {
  // create password
  var password = rpg({length: 16, set: 'lud'});

  // create url
  var url = "https://blockchain.info/api/v2/create_wallet";
  url += "?password=" + password;
  url += "&api_code=" + API_CODE;
  console.log("[Model] Fetching %s", url);

  // check to see if account already exists
  accountModel.findOne({phone: phone}, function (err, already_exist) {
    if (err) {
      console.error(err);
    } else if (already_exist) {
      console.log("[MongoDB] Account already exists:");
      console.log(already_exist);
      callback(null, "Error: Account already exists!");
    } else {
      // send the request to blockchain server
      request.post(url, function (err, httpResponse, body){
        if (err) {
          console.error(err);
        } else {
          console.log("[Model] Wallet is created:");
          body = JSON.parse(body);
          console.log(body);

          // save the account in the database
          upload_qr(body.address, function (url) {
            accountModel.create({
              guid: body.guid,
              address: body.address,
              password: password,
              phone: phone,
              qrurl: url
            }, function (err, account) {
              if (err) {
                console.error(err);
              } else {
                console.log("[MongoDB] Account is saved:");
                console.log(JSON.stringify(account));
                if (callback) {
                  callback(account);
                }
              }
            });
          });
        }
      });
    }
  });
};

/**
 * Send a request to the BlockChain server to get the balance
 * and give it back by invoking the callback
 *
 * @param phone {string} the phone number
 * @param callback {function} a callback function with 1 parameter
 */
var getBalance = function (phone, callback) {
  getAccount(phone, function (account) {
    if (account) {
      var url = "https://blockchain.info/merchant/";
      url += account.guid + "/balance?password=" + account.password;
      console.log("[Model] Fetching %s", url);

      request.get(url, function (err, httpResponse, balance) {
        if (err) {
          console.error(err);
        } else {
          balance = JSON.parse(balance);
          console.log("[Model] Balance is found: %s", balance);
          console.log(balance);
          if (callback) {
            callback(balance.balance);
          }
        }
      });
    } else {
      callback(null, "Error: Account does not exist!");
    }
  });
};

/**
 * Send a request to the BlockChain server to make a payment
 * to the account who has the target_address the amount of satoshi
 *
 * @param phone {string} the phone number
 * @param target_address {string} the address of the target
 * @param amount {number} the amount of satoshi to pay
 * @param callback {function} a callback function
 */
var makePaymentByAddress = function (phone, target_address, amount, callback) {
  // TODO: Modify this function
  getAccount(phone, function (account, error) {
    if (error) {
      console.error(error);
      callback(null, error);
    } else {
      var url = "https://blockchain.info/merchant/";
      url += account.guid + "/payment?password=" + account.password;
      url += "&to=" + target_address + "&amount=" + amount;
      console.log("[Model] Fetching %s", url);

      request.post(url, function (err, httpResponse, message) {
        if (err) {
          console.error(err);
        } else {
          console.log("[Model] Payment successful:");
          console.log(message);
          message = JSON.parse(message);

          if (callback) {
            if (message.error) {
              callback(null, "Error: " + message.error + " (satoshi)");
            } else {
              callback();
            }
          }
        }
      });
    }
  });
};

/**
 * Send a request to the BlockChain server to make a payment
 * to the account who has phone number target_phone the amount of satoshi
 *
 * @param phone {string} the phone number
 * @param target_phone {string} the phone number of the target
 * @param amount {number} the amount of satoshi to pay
 * @param callback {function} a callback function
 */
var makePaymentByPhone = function (phone, target_phone, amount, callback) {
  getAccount(phone, function(account, error1) {
    getAccount(target_phone, function(target_account, error2) {
      if (!(error1 || error2)) {
        var url = "https://blockchain.info/merchant/";
        url += account.guid + "/payment?password=" + account.password;
        url += "&to=" + target_account.address + "&amount=" + amount;
        console.log("[Model] Fetching %s", url);

        request.post(url, function (err, httpResponse, message) {
          if (err) {
            console.error(err);
          } else {
            console.log("[Model] Payment successful:");
            console.log(message);
            message = JSON.parse(message);
            if (callback) {
              if (message.error) {
                callback(null, "Error: " + message.error + " (satoshi)");
              } else {
                callback(target_account.phone);
              }
            }
          }
        });
      } else {
        var res = "Error: Your Account or the Target Account does not exist!";
        console.error(res);
        callback(null, res);
      }
    });
  });
};

/**/
var regenQRCode = function (phone, callback) {
  getAccount(phone, function (account) {
    upload_qr(account.address, function (url) {
      accountModel.findOneAndUpdate({phone:phone}, {qrurl:url}, function (err, doc) {
        console.log("[MongoDB] Updated: %s", JSON.stringify(doc));
        if (callback) {
          callback(url);
        }
      });
    });
  });
};

module.exports = {
  getAccount: getAccount,
  createWallet: createWallet,
  getBalance: getBalance,
  makePaymentByAddress: makePaymentByAddress,
  makePaymentByPhone: makePaymentByPhone,
  regenQRCode: regenQRCode
};
