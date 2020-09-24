const ztaklib = require('./src/')
const fs = require('fs')
const util = require('util')

//const testblock = fs.readFileSync('testblock.hex', 'utf8')
const hazwif = fs.readFileSync('../hazama_federation_root_wif', 'utf8').trim()

let id = Math.floor(Math.random() * 0xFFFFFF)
function rid() {
  id += 1
  return '' + id
}

//ztaklib.connect('wss://hazamaapi.indiesquare.net:443/ztak', async () => {
ztaklib.connect('ws://localhost:3041', async () => {
  console.log('Websocket connected')
  let { address: sourceAddress, wif, ecpair } = ztaklib.walletFromWif(hazwif)

  const exec = async (template, data) => {
    let code = await ztaklib.template(template, data)
    console.log(code)
    let tx = ztaklib.envelope(ztaklib.compile(code), wif)
    return ztaklib.tx(tx)
  }
  const nft_collection = '/hazama/nft' + rid()

  await exec('fungible_token', { // Get a template to send an NFT
    path: nft_collection,
    decimals: 2,
    name: 'Nft collection',
    tokenVersion: '1.0.0',
    author: sourceAddress
  })

  /*await exec('nft_history_drop_price', { // Get a template to send an NFT
    path: nft_collection,
    name: 'Nft collection',
    tokenVersion: '1.0.0',
    author: sourceAddress
  })

  let bid = await ztaklib.waitBlock()
  console.log('New block', bid)

  const issue = (name) => {
    return exec('nft_issuance', {
      path: nft_collection,
      name, price: 100
    })
  }

  let names = []

  for (let i=0; i < 1000; i++) {
    names.push('ticket'  + rid())
  }
  let txs = await Promise.all(names.map(x => issue(x)))
  console.log(txs)
  //await Promise.all(txs.map(x => ztaklib.waitTx(x)))
  await ztaklib.waitBlock()

  for (let i=0; i < txs.length; i++) {
    let txid = txs[i]
    let fed = await ztaklib.get(`/_/tx.${txid}.feds`)

    if (fed) {
      console.log(txid, fed['/hazama'].length > 0, names[i])
    } else {
      console.log(`*** ${txid} not found!!! ${names[i]}`)
    }
  }*/

})
