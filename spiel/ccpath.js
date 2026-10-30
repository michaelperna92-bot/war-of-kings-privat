// Wo liegt die Kartenwerkstatt? Im gemeinsamen Repository als Nachbarordner „kartenwerkstatt“, lokal als „cc“; oder per WOK_CC.
const fs = require('fs'), path = require('path');
module.exports = process.env.WOK_CC || [path.join(__dirname, '..', 'kartenwerkstatt'), path.join(__dirname, '..', 'cc')].find(p => fs.existsSync(path.join(p, 'data.js'))) || path.join(__dirname, '..', 'kartenwerkstatt');
