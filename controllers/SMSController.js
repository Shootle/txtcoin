var client = require('twilio')('ACe7faf8ca4cbaa71c9862e4a73f93574b', '8c6edb56e262e61e1614d7d8b0561552');
var blockchain = require('../models/BlockChainModel.js');

/**
 * Send an sms message to a receiving phone number
 *
 * @param {string} recipient - The phone number to receive the message
 * @param {string} message - The message to send
 */
var send_sms = function (recipient, message) {
  client.sendMessage({
    to: to,
    body: message
  });
};

var btc_regex = /[13][a-km-zA-HJ-NP-Z0-9]{26,33}$/;

/**
 * Converts amount in some unit to satoshis (100000000 Satoshi = 1 BTC)
 *
 * @param {string} unit - The units to convert from (BTC, cBTC, mBTC, Bit, satoshi);
 * @param {number} amount
 */
var convert_to_satoshi = function (unit, amount) {
  unit = unit.toUpperCase();

  if (unit === 'BTC') {
   return ~~(amount * 100000000); 
  } else if (unit === 'CBTC') {
   return ~~(amount * 1000000); 
  } else if (unit === 'MBTC') {
   return ~~(amount * 100000); 
  } else if (unit === 'BIT') {
   return ~~(amount * 100); 
  } else {
   return ~~(amount); 
  }
};

var commands = {
  /**
   * Sends the user help on a given command
   *
   *     help <command>
   */
  help: function (sender, args) {
  
  },

  /**
   * Creates a bitcoin wallet associated with a phone number
   *
   *     create_account
   */
  create_account: function (sender, args) {
    try {
      blockchain.createWallet(sender);
    } catch (e) {
      console.error(e);

      if (e instanceof blockchain.AccountExistsError) {
        send_sms(sender, 'Error: Account already exists!');
      }
    }
  },

  /**
   * Sends the user their current bitcoin wallet balance
   *
   *     balance
   */
  balance: function (sender, args) {
    blockchain.getBalance(sender, function (balance) {
      send_sms(sender, 'Current balance: ' + balance + 'BTC');
    });
  },

  /**
   * Send bitcoins to a phone number / bitcoin address
   *
   *     send <amount> <units> <recipient>
   */
  send: function (sender, args) {
    var amount = args[0];
    var unit = args[1];
    var receiver = args[2];
    
    amount = convert_to_satoshi(unit, amount);

    if (receiver.match(btc_regex)) {
      blockchain.makePaymentByAddress(sender, receiver, amount);
    } else { // assume phone number
      blockchain.makePaymentByPhone(sender, receiver, amount);
    }
  },

  /**
   * Request bitcoins from a phone number
   *
   *     request <amount> <phone number>
   */
  request: function (sender, args) {

  },

  /**
   * Send the last 3 transactions to the user
   *
   *     transactions
   */
  transactions: function (sender, args) {

  },

  /**
   * Send the user their bitcoin wallet
   *
   *     address
   */
  address: function (sender, args) {

  }
};

var parse_message = function (sender, message) {
  var args = message.split(' ');
  var command = args[0];
  var command_fn = commands[command];
  if (command_fn) {
    command_fn(sender, args.slice(1));
  } else {
    send_sms(sender, 'Error: ' + command + ' is an invalid command');
  }
};

/**
 * Called when a message is received.
 *
 * @param req - Node request object
 * @param res - Node response object
 */
var receive_sms = function (req, res) {
  var body = req.body;

  console.log(JSON.stringify(body));

  var sender = body.From;
  var message = body.Body;

  parse_message(sender, message);

  res.end();
};

module.exports = {
  commands: commands,
  parse_message: parse_message,
  send_sms: send_sms,
  receive_sms: receive_sms,
  convert_to_satoshi: convert_to_satoshi,
};