Meteor.Paypal = {

  account_options: {},
  //authorize submits a payment authorization to Paypal
  authorize: function(card_info, payment_info, callback){
    Meteor.call('paypal_submit', 'authorize', card_info, payment_info, callback);
  },
  purchase: function(card_info, payment_info, callback){
    Meteor.call('paypal_submit', 'sale', card_info, payment_info, callback);
  },
  //config is for the paypal configuration settings.
  config: function(options){
    this.account_options = options;
  },
  payment_json: function(){
    return {
      "intent": "sale",
      "payer": {
        "payment_method": "credit_card",
        "funding_instruments": []},
      "transactions": []
    };
  },
  //parseCardData splits up the card data and puts it into a paypal friendly format.
  parseCardData: function(data){
    var first_name = '', last_name = '';
    if (data.name){
      first_name = data.name.split(' ')[0];
      last_name = data.name.split(' ')[1]
    }
    return {
      credit_card: {
        type: data.type,
        number: data.number,
        first_name: first_name,
        last_name: last_name,
        cvv2: data.cvv2,
        expire_month: data.expire_month,
        expire_year: data.expire_year
      }};
  },
  //parsePaymentData splits up the card data and gets it into a paypal friendly format.
  parsePaymentData: function(data){
    return data;
  }
};

if(Meteor.isServer){
  Meteor.startup(function(){
    var paypal_sdk = Npm.require('paypal-rest-sdk');
    var Fiber = Npm.require('fibers');
    var Future = Npm.require('fibers/future');

    paypal_sdk.configure(Meteor.Paypal.account_options);
    Meteor.methods({
      paypal_submit: function(transaction_type, cardData, paymentData){
        paypal_sdk.configure(Meteor.Paypal.account_options);
        var payment_json = Meteor.Paypal.payment_json();
        payment_json.intent = transaction_type;
        if(cardData == null) {
          payment_json.payer = {
            payment_method: 'paypal'
          };
          payment_json.redirect_urls = Meteor.Paypal.account_options.redirect_urls;
        } else {
          payment_json.payer.funding_instruments.push(Meteor.Paypal.parseCardData(cardData));
        }
        payment_json.transactions.push(Meteor.Paypal.parsePaymentData(paymentData));
        var fut = new Future();
        this.unblock();
        paypal_sdk.payment.create(payment_json, Meteor.bindEnvironment(function(err, payment){
          if (err){
            console.log(err);
            fut.return({saved: false, error: err});
          } else {
            fut.return({saved: true, payment: payment});
          }
        },
        function(e){
          console.error(e);
        }));
        return fut.wait();
    }});
    // this is not a method because it should really only be
    // called by server-side code
    Meteor.Paypal.execute = function execute(payment_id, payer_id, callback) {
      paypal_sdk.payment.execute(payment_id, {payer_id: payer_id}, Meteor.Paypal.account_options, callback);
    };

    Meteor.Paypal.sdk = paypal_sdk;
  });
}
