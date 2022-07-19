const crypto = require("crypto");

function getHashSalt(password,salt=crypto.randomBytes(32).toString('hex')){
  const hash = crypto.createHmac('sha512',salt).update(password).digest('hex');
  return {
    salt,
    hash
  }
}
module.exports = {getHashSalt}