const ztaklib = require('./src/')
const fs = require('fs')
const util = require('util')
const chalk = require('chalk')

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
  //const destAddress = 'haBqcDvxe2bx64jW23hkj4vfJsfjUkjNEw'
  let { address: destAddress, wif: destWif } = ztaklib.createWallet()

  const sats = (x) => Math.floor(x * 100000000)
  const unsats = (x) => {
    if (!x) {
      return 0
    } else {
      return parseFloat(x) / 100000000
    }
  }

  const exec = async (template, data, dbg) => {
    let code = await ztaklib.template(template, data)
    if (dbg) {
      console.log(code.split('\n').map((l, idx) => {
        return `${idx + 1}> ${l}`
      }).join('\n'))
    }
    let tx = ztaklib.envelope(ztaklib.compile(code), wif)
    return ztaklib.tx(tx)
  }

  const execDst = async (template, data, dbg) => {
    let code = await ztaklib.template(template, data)
    if (dbg) {
      console.log(code.split('\n').map((l, idx) => {
        return `${idx + 1}> ${l}`
      }).join('\n'))
    }
    let tx = ztaklib.envelope(ztaklib.compile(code), destWif)
    return ztaklib.tx(tx)
  }

  const test = (predicate, value, expected) => {
    let tags = {
      true: chalk.green('PASS'),
      false: chalk.red('FAIL')
    }
    let condition = value === expected

    console.log(`[${tags[condition]}] ${predicate} should be ${expected}, got ${value}`)
  }

  const ft_path = '/hazama/ft' + rid()
  const testFt = async () => {

    await exec('fungible_token', { // Get a template to send an NFT
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

    console.log('Starting fungible token sends')
    console.log('Deploying contract', ft_path)

    console.log('* Issuances')
    await fungibleIssue(10000)
    await ztaklib.waitBlock()
    //test(sourceAddress, (await ztaklib.get(`${ft_path}/${sourceAddress}`))[0], 10000)
    await sleep(100)
    console.log(await ztaklib.get(`${ft_path}/${sourceAddress}`))

    await fungibleIssue(10000)
    await ztaklib.waitBlock()
    test(sourceAddress, (await ztaklib.get(`${ft_path}/${sourceAddress}`)), 20000)

    console.log('* Sends')
    await fungibleSend(destAddress, 5000)
    await ztaklib.waitBlock()
    //await sleep(1000)

    test(sourceAddress, (await ztaklib.get(`${ft_path}/${sourceAddress}`)), 15000)
    test(destAddress, (await ztaklib.get(`${ft_path}/${destAddress}`)), 5000)

    console.log('* Another issuance')
    await fungibleIssue(7000)
    await ztaklib.waitBlock()
    test(sourceAddress, (await ztaklib.get(`${ft_path}/${sourceAddress}`)), 22000)

    //console.log(sourceAddress, await ztaklib.get(`/_/addr.${sourceAddress}`))
  }

  const nft_collection = '/hazama/nft' + rid()
  const nftNames = []
  const testNft = async () => {
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

    const send = (name, destination) => {
      return exec('nft_send', {
        path: nft_collection,
        name, destination
      })
    }

    const doNIssuances = async (n) => {
      for (let i=0; i < n; i++) {
        nftNames.push('ticket'  + rid())
      }
      //let txs = await Promise.all(names.map(x => issue(x)))
      let tx = await exec('nft_multi_issuance', {
        path: nft_collection,
        issuances: nftNames.map(x => ({
          name: x, price: 100
        }))
      })
      let txs = [tx]
      await ztaklib.waitBlock()

      /*for (let i=0; i < txs.length; i++) {
        let txid = txs[i]
        let fed = await ztaklib.get(`/_/tx.${txid}.feds`)

        if (fed) {
          console.log(txid, fed['/hazama'].length > 0, names[i])
        } else {
          console.log(`*** ${txid} not found!!! ${names[i]}`)
        }
      }*/

      return {names: nftNames, txs}
    }

    const doSends = async (assets) => {
      let tx = await exec('nft_multi_send_with_price', {
        path: nft_collection,
        sends: assets.map(x => ({
          name: x, destination: destAddress, price: Math.floor(Math.random() * 500 + 100)
        }))
      })
      //let txs = await Promise.all(assets.map(x => send(x, destAddress)))
      await ztaklib.waitBlock()

      //return txs
      return [tx]
    }

    const checkIdx = (idx, checkTxs, kind) => {
      let {txs, ...locator} = idx
      let mapLocator = Object.fromEntries(Object.values(locator).map(x => [x, true]))

      for (let i=0; i < checkTxs.length; i++) {
        let tx = checkTxs[i]
        if (!(tx in txs)) {
          console.log(`Couldn't find tx ${tx} in index ${kind}`)
        }

        if (!(tx in mapLocator)) {
          console.log(`Couldn't find tx ${tx} in locator ${kind}`)
        }
      }
    }

    let { names: iss, txs: issTxs } = await doNIssuances(150)
    let snds = await doSends(iss, destAddress)
    await sleep(1000)
    let idxSrc = await ztaklib.get(`/_/addr.${sourceAddress}`)
    let idxDst = await ztaklib.get(`/_/addr.${destAddress}`)
    checkIdx(idxSrc, issTxs, 'issuances')
    checkIdx(idxSrc, snds, 'sends')
    checkIdx(idxDst, snds, 'receives')

    for (let i=0; i < nftNames.length; i++) {
      let ob = await ztaklib.get(nft_collection + '/' + nftNames[i])
      console.log(ob)
    }

    /*await doSends(await doNIssuances(10), destAddress)
    console.log(await ztaklib.get(`/_/addr.${destAddress}`))*/
  }

  const testNftCron = async () => {

    await exec('nft_history_drop_price', { // Get a template to send an NFT
      path: nft_collection,
      name: 'Nft collection',
      tokenVersion: '1.0.0',
      author: sourceAddress
    })

    await ztaklib.waitBlock()
    console.log('New block')

    const issue = (name) => {
      return exec('nft_issuance', {
        path: nft_collection,
        name, price: 100
      })
    }

    const send = (name, destination) => {
      return exec('nft_send', {
        path: nft_collection,
        name, destination
      })
    }

    const checkPrices = async () => {
      for (let i=0; i < nftNames.length; i++) {
        let id = `${nft_collection}/${nftNames[i]}`
        let item = await ztaklib.get(id)
        console.log(id, item.price)
      }
    }

    const doDropPrice = async (timeout, drop) => {
      let t = Date.now() + timeout
      console.log('Creating drop on ts', t)
      let cronCall = [
        'REQUIRE ' + nft_collection,
        'PUSHI ' + t,
        'PUSHI ' + drop,
        'ECALL ' + nft_collection + ':program_drop',
        'END'
      ]
      let tx = ztaklib.envelope(ztaklib.compile(cronCall.join('\n')), wif)
      await ztaklib.tx(tx)
      return t
    }

    const doCancelDrop = async (t) => {
      let cronCall = [
        'REQUIRE ' + nft_collection,
        'PUSHI ' + t,
        'ECALL ' + nft_collection + ':cancel_drop',
        'END'
      ]
      let tx = ztaklib.envelope(ztaklib.compile(cronCall.join('\n')), wif)
      await ztaklib.tx(tx)
    }

    await checkPrices()
    await sleep(1000)

    await doDropPrice(5000, 10)
    let id = await doDropPrice(7000, 20)
    await doDropPrice(9000, 30)
    await ztaklib.waitBlock()

    console.log('Calling cancel on', id)
    await doCancelDrop(id)
    await ztaklib.waitBlock()

    await sleep(5100)
    await checkPrices()

    await sleep(2000)
    await checkPrices()
    await sleep(2000)
    await checkPrices()
  }

  const testDex = async () => {
    console.log('Testing the DEX')
    const r = rid()
    const base = 'btc' + r
    const quote = 'usd' + r
    const btk = `/hazama/${base}`
    const qtk = `/hazama/${quote}`

    const printBalances = async () => {
      let sbbal = unsats(await ztaklib.get(`${btk}/${sourceAddress}`))
      let sqbal = unsats(await ztaklib.get(`${qtk}/${sourceAddress}`))
      let dbbal = unsats(await ztaklib.get(`${btk}/${destAddress}`))
      let dqbal = unsats(await ztaklib.get(`${qtk}/${destAddress}`))

      console.log('Source:', btk, sbbal, '|', qtk, sqbal)
      console.log('Dest:', btk, dbbal, '|', qtk, dqbal)
    }

    const fungibleIssue = (t, n) => {
      return exec('fungible_token_issuance', { // Get a template to issue a FT
        path: t,
        amount: n
      })
    }

    const fungibleSend = (t, dest, n) => {
      return exec('fungible_token_send', { // Get a template to send an NFT
        path: t,
        amount: n,
        destination: dest
      })
    }

    console.log('Emitting ' + btk)
    await exec('fungible_token', {
      path: btk,
      decimals: 8,
      name: 'base',
      tokenVersion: '1.0.0',
      author: sourceAddress
    })
    console.log('Emitting ' + qtk)
    await exec('fungible_token', {
      path: qtk,
      decimals: 8,
      name: 'quote',
      tokenVersion: '1.0.0',
      author: sourceAddress
    })
    await ztaklib.waitBlock()

    console.log('Creating the dex')
    await exec('fungible_dex', {
      base, quote,
      baseContract: btk,
      quoteContract: qtk,
      dexVersion: '1.0.0',
      author: sourceAddress
    })
    await ztaklib.waitBlock()

    fungibleIssue(qtk, sats(10781))
    fungibleIssue(btk, sats(1.1))
    await ztaklib.waitBlock()
    fungibleSend(btk, destAddress, sats(1.1))
    await ztaklib.waitBlock()
    await sleep(1000)

    console.log('>>>> Before orders')
    await printBalances()

    const fwd = async () => {
      console.log('Opening a forward order')
      let txid = await execDst('fungible_dex_open_order', {
        base, quote,
        give: sats(0.1),
        get: sats(1078),
        direction: 'forward'
      })
      console.log('Forward txid:', txid)
      await ztaklib.waitBlock()
      await sleep(1000)

      return txid
    }

    const bck = async () => {
      console.log('Opening a backward order')
      let txid = await exec('fungible_dex_open_order', {
        base, quote,
        give: sats(10780),
        get: sats(1),
        direction: 'backward'
      })
      console.log('Backward txid:', txid)
      await ztaklib.waitBlock()
      await sleep(1000)

      return txid
    }

    let fwdTxid = await fwd()
    let bckTxid = await bck()
    /*console.log('---- Mid orders')
    await printBalances()
    let bckId = `/hazama/dex${base}${quote}/bck${bckTxid}`
    let bckOrd = await ztaklib.get(bckId)
    console.log('Backward order:', bckId, bckOrd)
    console.log('Backward escrow:', base, await ztaklib.get(`${qtk}/${bckTxid}`))*/


    let fwdId = `/hazama/dex${base}${quote}/fwd${fwdTxid}`
    let fwdOrd = await ztaklib.get(fwdId)
    console.log('Forward order:', fwdId, fwdOrd)
    console.log('Forward escrow:', quote, await ztaklib.get(`${btk}/${fwdTxid}`))

    console.log('<<<< After orders')
    await printBalances()

    console.log('Listo')
  }

  await testDex()
  //await testFt()
  //await testNft()
  //testNftCron()
  //console.log(await ztaklib.get(`/hazama/yutacoin/hUtk4YtkSmewf9L8KuRR385NLMpD7dPJUr`))
})
