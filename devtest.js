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

const sleep = (n) => new Promise(resolve => setTimeout(resolve, n))

//ztaklib.connect('wss://hazamaapi.indiesquare.net:443/ztak', async () => {
ztaklib.connect('ws://localhost:3041', async () => {
  console.log('Websocket connected')
  let { address: sourceAddress, wif, ecpair } = ztaklib.walletFromWif(hazwif)

  const exec = async (template, data) => {
    let code = await ztaklib.template(template, data)
    let tx = ztaklib.envelope(ztaklib.compile(code), wif)
    return ztaklib.tx(tx)
  }
  const nft_collection = '/hazama/nft' + rid()
  const ft_path = '/hazama/ft' + rid()

  /*await exec('fungible_token', { // Get a template to send an NFT
    path: ft_path,
    decimals: 2,
    name: 'ft',
    tokenVersion: '1.0.0',
    author: sourceAddress
  })
  await ztaklib.waitBlock()

  const fungibleIssue = (n) => {
    return exec('fungible_token_issuance', { // Get a template to issue a FT
      path: ft_path,
      amount: n
    })
  }

  const fungibleSend = (dest, n) => {
    return exec('fungible_token_send', { // Get a template to send an NFT
      path: ft_path,
      amount: n,
      destination: dest
    })
  }

  await fungibleIssue(10000)
  await ztaklib.waitBlock()
  console.log(sourceAddress, await ztaklib.get(`${ft_path}/${sourceAddress}`))

  let destAddress = 'haBqcDvxe2bx64jW23hkj4vfJsfjUkjNEw'
  await fungibleSend(destAddress, 5000)
  await ztaklib.waitBlock()
  await sleep(1000)

  console.log(sourceAddress, await ztaklib.get(`${ft_path}/${sourceAddress}`))
  console.log(destAddress, await ztaklib.get(`${ft_path}/${destAddress}`))

  console.log(sourceAddress, await ztaklib.get(`/_/addr.${sourceAddress}`))*/


  await exec('nft_history_drop_price', { // Get a template to send an NFT
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

  for (let i=0; i < 50; i++) {
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
  }

})
