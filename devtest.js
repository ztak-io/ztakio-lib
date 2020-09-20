const ztaklib = require('./src/')
const fs = require('fs')
const util = require('util')

//const wif = fs.readFileSync('.wif', 'utf8').trim()

/*ztaklib.setNetwork({
  "messagePrefix": "\u0018Hazama Signed Message:\n",
  "bech32": "haz",
  "bip32": {
    "public": "0x0488b21e",
    "private": "0x0488ade4"
  },
  "H_pubKeyHash": 41,
  "pubKeyHash": 100,
  "wif": 149
})*/

//ztaklib.connect('wss://hazamaapi.indiesquare.net:443/ztak', async () => {
ztaklib.connect('ws://localhost:3041', async () => {
  console.log('Websocket connected')
  /*let wallet = ztaklib.createWallet()
  console.log(wallet)*/
  ztaklib.watch('.*', console.log)

  /*let tx = await ztaklib.get('/_/tx.6fd972a594fde6af5191f928d7c655e4be13f5d076ed50308386b32ec08acb09')
  console.log(util.inspect(ztaklib.decodeCall(tx), {depth: 4, colors: true}))*/

  /*let code = await ztaklib.template('nft_send', {path: '/hazama/nft', name: 'test1', destination: 'hQbbZu7i54bXiu4rhdngBUmQB8xbDK6hEc'})
  let compiled = ztaklib.compile(code)
  let envelope = ztaklib.envelope(compiled, wif)

  try {
    let conf = await ztaklib.tx(envelope)
    console.log(conf)
  } catch(e) {
    console.log(e)
  }*/
})
