const EventEmitter = require('events')
const {promisify} = require('util')
const url = require('url')
const rpc = require('json-rpc2')
const ztak = require('ztakio-core')
const bitcoin = require('bitcoinjs-lib')

const lib = new EventEmitter()
let currentClient
let currentConnection
let generalServerInfo
let ztakNetworkSetupManually = false

lib.connect = (endpoint, cb) => {
  let endpointData = url.parse(endpoint)

  let user
  let pass

  if (endpointData.auth) {
    [user, pass] = endpointData.auth.split(':')
  }

  let connectHost
  if (endpointData.hostname) {
    connectHost = endpointData.hostname
  } else {
    connectHost = endpointData.pathname
  }

  let connectPort
  if (endpointData.port) {
    connectPort = parseInt(endpointData.port)
  } else {
    if (endpointData.protocol === 'wss:' || endpointData.protocol === 'https:') {
      connectPort = 443
    } else {
      connectPort = 80
    }
  }

  const client = rpc.Client.$create(connectPort, connectHost, user, pass)
  if (endpointData.protocol === 'wss:' || endpointData.protocol === 'https:') {
    console.log('wss://' + client.host + ':443' + endpointData.path)
  }
  client.host = endpointData.href

  client.connectWebsocket(async (err, result) => {
    if (err) {
      throw err
    } else if (!result) {
      throw new Error('Couldn\'t connect to endpoint')
    } else {
      currentConnection = result
      currentConnection.callAsync = promisify(currentConnection.call)
      currentClient = client

      let info = await currentConnection.callAsync('core.info', [])
      if (info.network) {
        generalServerInfo = info
        ztak.networks.mainnet = info.network
        if (ztakNetworkSetupManually) {
          setNetworkDeprecationNotice()
        }
      }

      if (cb) {
        cb()
      }
      lib.emit('connected')

      lib.watch('\\/_\\/block\\..*', (k) => {
        lib.emit('new block', k)
      })

      lib.watch('\\/_\\/tx\\..*', (k) => {
        lib.emit('new tx', k)
      })

      currentClient.expose('event', ([key]) => {
        lib.emit('_raw_event', key)
      })

      currentClient.expose('verifyevent', ([msg]) => {
        lib.emit('_verify_event', msg)
      })

      /*currentClient.expose('verifyevent', ([msg]) => {
        console.log('Got verify event')
        lib.emit('_verify_event', msg)
      })*/
    }
  })
}

function setNetworkDeprecationNotice() {
  console.log('Deprecation notice: ztaklib.setNetwork() isn\'t necessary on this server instance')
}

lib.setNetwork = (network) => {
  if (generalServerInfo) {
    setNetworkDeprecationNotice()
  } else {
    ztakNetworkSetupManually = true
    ztak.networks.mainnet = network
  }
}

lib.compile = (code) => {
  return ztak.asm.compile(code)
}

lib.envelope = (bytecode, wif) => {
  if (typeof(bytecode) === 'string') {
    bytecode = Buffer.from(bytecode, 'hex')
  }

  const ecpair = bitcoin.ECPair.fromWIF(wif)
  return ztak.buildEnvelope(ecpair, bytecode)
}

lib.template = (name, params) => {
  return currentConnection.callAsync('core.template', [name, params])
}

lib.get = (key) => {
  return currentConnection.callAsync('core.get', [key])
}

lib.iterate = async (options, amount) => {
  let iterId = await currentConnection.callAsync('core.inititerator', [options])
  let finished = false
  let next = async () => {
    if (finished) {
      return null
    } else {
      let results = await currentConnection.callAsync('core.fetchiterator', [iterId, amount])
      if (!results/*.length < amount*/) {
        finished = true
      }

      return results
    }
  }

  return next
}

lib.tx = (data) => {
  if (Buffer.isBuffer(data)) {
    data = data.toString('hex')
  }

  return currentConnection.callAsync('core.tx', [data])
}

lib.block = (data) => {
  if (Buffer.isBuffer(data)) {
    data = data.toString('hex')
  }

  return currentConnection.callAsync('core.block', [data])
}

lib.watch = (regex, handler) => {
  const r = new RegExp(regex)
  lib.on('_raw_event', (key) => {
    if (r.test(key)) {
      handler(key)
    }
  })
  currentConnection.callAsync('core.subscribe', [regex])
}

lib.verifyEvents = (handler) => {
  lib.on('_verify_event', (msg) => {
    handler(msg)
  })
  currentConnection.callAsync('core.verifyevents', [])
}

lib.createWallet = () => {
  const ecpair = bitcoin.ECPair.makeRandom()
  let network = ztak.networks.mainnet
  const { address } = bitcoin.payments.p2pkh({ pubkey: ecpair.publicKey, network: network })

  return { address, wif: ecpair.toWIF(), ecpair }
}

lib.walletFromWif = (wif) => {
  const ecpair = bitcoin.ECPair.fromWIF(wif)
  let network = ztak.networks.mainnet
  const { address } = bitcoin.payments.p2pkh({ pubkey: ecpair.publicKey, network: network })

  return { address, wif: ecpair.toWIF(), ecpair }
}

lib.decodeCall = (envelope) => {
  let msg = ztak.openEnvelope(Buffer.from(envelope, 'hex'))
  let lines = ztak.asm.unpack(msg.data).filter(x => x.opName !== 'NOOP' && x.opName !== 'END' && x.opName !== 'REQUIRE')
  let calls = []
  let params = []
  for (let i=0; i < lines.length; i++) {
    let item = lines[i]
    if (item.opName.startsWith('PUSH')) {
      params.push(item.params[0])
    } else if (item.opName === 'ECALL') {
      calls.push({ [item.params[0]]: params })
      params = []
    }
  }
  return {from: msg.from, calls}
}

lib.waitBlock = () => new Promise((resolve) => {
  lib.once('new block', () => {
    setTimeout(resolve, 10) // Needs a tiny bit of wait
  })
})

lib.waitTx = (txid) => new Promise((resolve) => {
  let watcher = (k) => {
    if (k.indexOf(txid) >= 0) {
      resolve(k)
    }
    lib.removeListener('new tx', watcher)
  }
  lib.on('new tx', watcher)
})

lib.disconnect = () => {
  currentConnection.end()
}

module.exports = lib
